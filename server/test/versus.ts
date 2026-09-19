/** Игра между игроками: битвы и джекпот. Два настоящих аккаунта, настоящий HTTP. */
import { spawn } from 'node:child_process'
import { ACHIEVEMENTS } from '../src/core/economy.js'

const REWARD = new Map(ACHIEVEMENTS.map((a) => [a.id, a.reward]))
/** Сколько MX донесли достижения, открытые между двумя снимками профиля. */
const bonusBetween = (before: string[], after: string[]) =>
  after.filter((id) => !before.includes(id)).reduce((s, id) => s + (REWARD.get(id) ?? 0), 0)

// порт случайный: так прогон никогда не попадёт на чужой сервер
const PORT = String(20000 + Math.floor(Math.random() * 20000))
const BASE = `http://127.0.0.1:${PORT}`
let failures = 0
const check = (label: string, cond: boolean, extra = '') => {
  if (!cond) failures++
  console.log(`  ${cond ? '✓' : '✗ ОШИБКА'} ${label}${extra ? '  ' + extra : ''}`)
}

const srv = spawn('npx', ['tsx', 'src/index.ts'], {
  env: { ...process.env, PORT, LOG_LEVEL: 'silent', JACKPOT_WAIT_MS: '2000' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
srv.stderr.on('data', (d) => { const s = String(d); if (s.includes('Error')) console.error(s) })
process.on('exit', () => srv.kill())
process.on('uncaughtException', (e) => { console.error(e); srv.kill(); process.exit(1) })
process.on('unhandledRejection', (e) => { console.error(e); srv.kill(); process.exit(1) })

const call = async (path: string, token: string, body?: unknown) => {
  const res = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => null) as any }
}

for (let i = 0; i < 60; i++) {
  try { await fetch(BASE + '/health'); break } catch { await new Promise((r) => setTimeout(r, 400)) }
}

/** Завести игрока с деньгами на счету. */
async function player(tag: string) {
  const login = `${tag}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
  const reg = await call('/auth/register', '', { login, password: 'secret123' })
  const token: string = reg.body.access
  await call('/me/import', token, { balance: 2_000_000, xp: 0, inventory: [] })
  return {
    token,
    login,
    me: async () => (await call('/me', token)).body,
    balance: async () => (await call('/me', token)).body.balance,
    snap: async () => {
      const m = (await call('/me', token)).body
      return { balance: m.balance as number, achievements: m.achievements as string[] }
    },
  }
}

const alice = await player('alice')
const bob = await player('bob')

console.log('БИТВЫ · СОЗДАНИЕ')
let battleId = ''
{
  const before = await alice.balance()
  const r = await call('/battle/create', alice.token, { caseId: 'emoji', rounds: 3, seats: 2 })
  check('битва создана', r.status === 200 && r.body.status === 'open', r.body?.error ?? '')
  battleId = r.body.id
  check('ставка равна цене кейса на число раундов', r.body.bet === 130 * 3, String(r.body?.bet))
  check('деньги списаны', (await alice.balance()) === before - 130 * 3)
  check('создатель занял первое место', r.body.players.length === 1 && r.body.players[0].me)
  check('хэш сида виден сразу', typeof r.body.fair.serverSeedHash === 'string' && r.body.fair.serverSeedHash.length === 64)
  check('сам сид до боя скрыт', r.body.fair.serverSeed === null)

  const list = await call('/battle/list', bob.token)
  check('битва видна другому игроку', list.body.battles.some((b: any) => b.id === battleId))
}

console.log('\nБИТВЫ · ОТКАЗЫ')
{
  check('в свою же битву не зайти дважды', (await call(`/battle/${battleId}/join`, alice.token, {})).status === 409)
  check('чужую битву ботами не добить', (await call(`/battle/${battleId}/bots`, bob.token, {})).status === 400)
  const nope = await call('/battle/create', alice.token, { caseId: 'нет', rounds: 3, seats: 2 })
  check('неизвестный кейс отклонён', nope.status === 400, nope.body?.error ?? '')
  const seats = await call('/battle/create', alice.token, { caseId: 'emoji', rounds: 3, seats: 9 })
  check('больше четырёх мест нельзя', seats.status === 400)
}

console.log('\nБИТВЫ · БОЙ')
{
  const aliceBefore = await alice.snap()
  const bobBefore = await bob.snap()
  const invA = (await alice.me()).inventory.length
  const invB = (await bob.me()).inventory.length

  const r = await call(`/battle/${battleId}/join`, bob.token, {})
  check('второй игрок зашёл и бой сыгран', r.status === 200 && r.body.status === 'done', r.body?.error ?? '')
  check('сид раскрыт после боя', typeof r.body.fair.serverSeed === 'string')
  check('у каждого по три предмета', r.body.players.every((p: any) => p.drops.length === 3))
  check('победитель определён', r.body.winnerSeat === 0 || r.body.winnerSeat === 1)

  const pot = r.body.players.reduce((s: number, p: any) => s + p.total, 0)
  const winnerIsAlice = r.body.winnerSeat === 0
  const gotA = (await alice.me()).inventory.length - invA
  const gotB = (await bob.me()).inventory.length - invB
  check('банк ушёл одному игроку целиком', (winnerIsAlice ? gotA : gotB) === 6 && (winnerIsAlice ? gotB : gotA) === 0,
    `Алиса +${gotA}, Боб +${gotB}`)
  check('банк совпал с суммой выпавшего', pot > 0, String(pot))
  const aliceAfter = await alice.snap()
  const bobAfter = await bob.snap()
  check(
    'со счёта Боба списана ставка',
    bobAfter.balance === bobBefore.balance - 390 + bonusBetween(bobBefore.achievements, bobAfter.achievements),
    `${bobAfter.balance} против ${bobBefore.balance - 390}`,
  )
  check(
    'Алиса получила только предметы, без денег',
    aliceAfter.balance === aliceBefore.balance + bonusBetween(aliceBefore.achievements, aliceAfter.achievements),
    `${aliceAfter.balance} против ${aliceBefore.balance}`,
  )

  const winner = winnerIsAlice ? alice : bob
  check('победа записана в статистику', (await winner.me()).stats.battlesWon === 1)
  check('закрытая битва пропала из списка',
    !(await call('/battle/list', bob.token)).body.battles.some((b: any) => b.id === battleId))
  check('повторный вход в сыгранную битву отклонён', (await call(`/battle/${battleId}/join`, bob.token, {})).status === 409)
}

console.log('\nБИТВЫ · ПРОТИВ БОТОВ')
{
  const r0 = await call('/battle/create', alice.token, { caseId: 'starter', rounds: 2, seats: 4 })
  const r = await call(`/battle/${r0.body.id}/bots`, alice.token, {})
  check('битва с ботами сыграна', r.status === 200 && r.body.status === 'done', r.body?.error ?? '')
  check('все места заняты', r.body.players.length === 4)
  check('три места достались ботам', r.body.players.filter((p: any) => p.bot).length === 3)
}

console.log('\nДЖЕКПОТ')
{
  const start = await call('/jackpot', alice.token)
  check('комната открыта', start.status === 200 && start.body.room.status === 'open', start.body?.error ?? '')
  check('пустой банк и нет таймера', start.body.room.pot === 0 && start.body.room.closesAt === null)

  const before = await alice.balance()
  const join = await call('/jackpot/join', alice.token, { bet: 1000 })
  check('вход в банк принят', join.status === 200, join.body?.error ?? '')
  check('деньги списаны', join.body.balance === before - 1000)
  check('банк вырос', join.body.room.pot === 1000)
  check('таймер запущен', typeof join.body.room.closesAt === 'number')
  check('повторный вход отклонён', (await call('/jackpot/join', alice.token, { bet: 500 })).status === 409)

  const joinB = await call('/jackpot/join', bob.token, { bet: 3000 })
  check('второй игрок вошёл', joinB.status === 200 && joinB.body.room.pot === 4000, String(joinB.body?.room?.pot))
  check('доли посчитаны', Math.abs(joinB.body.room.entries.find((e: any) => e.me).share - 0.75) < 1e-9)
  check('маленькая ставка отклонена', (await call('/jackpot/join', bob.token, { bet: 1 })).status === 400)

  const aBefore = await alice.snap()
  const bBefore = await bob.snap()
  await new Promise((r) => setTimeout(r, 2400))

  const after = await call('/jackpot', alice.token)
  check('комната разыграна', after.body.last?.status === 'done', JSON.stringify(after.body.last)?.slice(0, 80) ?? 'нет')
  const last = after.body.last
  check('сид раскрыт', typeof last.fair.serverSeed === 'string')
  check('победитель назван', !!last.winnerName)
  const prize = Math.round(last.pot * (1 - last.rake))
  const aAfter = await alice.snap()
  const bAfter = await bob.snap()
  // достижение «Сорвал банк» приходит вместе с выигрышем — вычитаем его
  const gotA = aAfter.balance - aBefore.balance - bonusBetween(aBefore.achievements, aAfter.achievements)
  const gotB = bAfter.balance - bBefore.balance - bonusBetween(bBefore.achievements, bAfter.achievements)
  check('приз получил ровно один', (gotA === prize) !== (gotB === prize), `Алиса +${gotA}, Боб +${gotB}, приз ${prize}`)
  check('проигравший не получил ничего', gotA === 0 || gotB === 0)
  check('комиссия удержана', prize < last.pot && prize === Math.round(last.pot * 0.92), `${prize} из ${last.pot}`)
  check('открыта следующая комната', after.body.room.status === 'open' && after.body.room.id !== last.id)
}

console.log('\nДОСТУП')
{
  check('без токена список битв закрыт', (await call('/battle/list', '')).status === 401)
  check('без токена в банк не войти', (await call('/jackpot/join', '', { bet: 100 })).status === 401)
}

console.log(failures ? `\n${failures} проверок провалено` : '\nвсе проверки пройдены')
srv.kill()
process.exit(failures ? 1 : 0)
