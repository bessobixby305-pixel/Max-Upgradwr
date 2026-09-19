/** Проверка игровых ручек по-настоящему: поднимаем сервер, бьём в HTTP.
 *  Главное, что здесь проверяется, — деньги сходятся и обмануть сервер
 *  параметрами запроса нельзя. */
import { spawn } from 'node:child_process'

const BASE = 'http://127.0.0.1:3112'
let failures = 0
const check = (label: string, cond: boolean, extra = '') => {
  if (!cond) failures++
  console.log(`  ${cond ? '✓' : '✗ ОШИБКА'} ${label}${extra ? '  ' + extra : ''}`)
}

const srv = spawn('npx', ['tsx', 'src/index.ts'], {
  env: { ...process.env, PORT: '3112', LOG_LEVEL: 'silent' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
srv.stderr.on('data', (d) => { const s = String(d); if (s.includes('Error')) console.error(s) })
// иначе упавший тест оставит сервер висеть на порту, и следующий прогон
// будет разговаривать со старым процессом
process.on('exit', () => srv.kill())
process.on('uncaughtException', (e) => { console.error(e); srv.kill(); process.exit(1) })
process.on('unhandledRejection', (e) => { console.error(e); srv.kill(); process.exit(1) })

let token = ''
const api = async (path: string, body?: unknown, auth = true) => {
  const res = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...(auth && token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => null) as any }
}

for (let i = 0; i < 60; i++) {
  try { await fetch(BASE + '/health'); break } catch { await new Promise((r) => setTimeout(r, 400)) }
}

const login = 'player_' + Date.now().toString(36)
token = (await api('/auth/register', { login, password: 'secret123' }, false)).body.access
const me = async () => (await api('/me')).body

// стартовой тысячи мало для длинных серий — переносим «сохранение» пожирнее
await api('/me/import', { balance: 5_000_000, xp: 0, inventory: [] })

console.log('ДОСТУП')
{
  const saved = token
  token = ''
  check('без токена не сыграть', (await api('/play/dice', { bet: 10, target: 50, over: true })).status === 401)
  token = saved
}

console.log('\nПРОВЕРКА ПАРАМЕТРОВ')
{
  const huge = await api('/play/dice', { bet: 10 ** 15, target: 50, over: true })
  check('ставка больше баланса отклонена', huge.status === 400, huge.body?.error ?? '')
  check('нулевая ставка отклонена', (await api('/play/dice', { bet: 0, target: 50, over: true })).status === 400)
  check('дробная ставка отклонена', (await api('/play/dice', { bet: 10.5, target: 50, over: true })).status === 400)
  check('порог вне диапазона отклонён', (await api('/play/dice', { bet: 10, target: 99, over: true })).status === 400)
  const bigMult = await api('/play/upgrade', { bet: 10, mult: 500 })
  check('множитель выше предела отклонён', bigMult.status === 400, bigMult.body?.error ?? '')
  check('чужой кейс отклонён', (await api('/play/case', { caseId: 'нет-такого' })).status === 400)
  check('несуществующий предмет отклонён', (await api('/play/upgrade', { bet: 10, targetId: 'нет' })).status === 400)
}

console.log('\nДЕНЬГИ СХОДЯТСЯ')
{
  const before = (await me()).balance
  let bets = 0
  let paid = 0
  let last = before
  for (let i = 0; i < 40; i++) {
    const r = await api('/play/dice', { bet: 1000, target: 50, over: true })
    if (r.status !== 200) { check('серия костей без ошибок', false, r.body?.error ?? ''); break }
    bets += 1000
    paid += r.body.outcome.payout
    last = r.body.balance
  }
  const after = (await me()).balance
  check('ответ и профиль показывают один баланс', after === last, `${after} и ${last}`)
  // достижения могут донести сверху, поэтому сверяем «не меньше»
  check('баланс сходится по ставкам и выплатам', after >= before - bets + paid, `${after} против ${before - bets + paid}`)
}

console.log('\nКЕЙСЫ И ИНВЕНТАРЬ')
let uids: string[] = []
{
  const before = (await me()).balance
  const r = await api('/play/case', { caseId: 'starter' })
  check('кейс открылся', r.status === 200 && !!r.body.item, r.body?.error ?? '')
  // достижение за первый кейс может донести сверху — учитываем его
  const bonus = (r.body.unlocked ?? []).reduce((s: number, a: any) => s + a.reward, 0)
  check('со счёта списана ровно цена кейса', r.body.balance === before - 60 + bonus, `${r.body.balance} против ${before - 60 + bonus}`)
  const inv = (await me()).inventory
  check('предмет попал в инвентарь', inv.some((i: any) => i.uid === r.body.item.uid))

  for (let i = 0; i < 4; i++) await api('/play/case', { caseId: 'starter' })
  uids = (await me()).inventory.slice(0, 3).map((i: any) => i.uid)
}

console.log('\nКОНТРАКТ')
{
  const r = await api('/play/contract', { uids })
  check('контракт сыгран', r.status === 200 && !!r.body.item, r.body?.error ?? '')
  const inv = (await me()).inventory.map((i: any) => i.uid)
  check('исходные предметы сгорели', uids.every((u) => !inv.includes(u)))
  check('выдан новый предмет', inv.includes(r.body.item.uid))
  const again = await api('/play/contract', { uids })
  check('повторный контракт теми же предметами отклонён', again.status === 400, again.body?.error ?? '')
}

console.log('\nПРОДАЖА')
{
  const inv = (await me()).inventory
  const before = (await me()).balance
  const r = await api('/inventory/sell', { uids: [inv[0].uid] })
  check('предмет продан', r.status === 200 && r.body.gain > 0, String(r.body?.gain))
  check('деньги зачислены', r.body.balance === before + r.body.gain)
  check('повторная продажа отклонена', (await api('/inventory/sell', { uids: [inv[0].uid] })).status === 400)
}

console.log('\nМИНЫ')
{
  const start = await api('/play/mines/start', { bet: 1000, mines: 3 })
  check('раунд начат', start.status === 200 && !!start.body.roundId, start.body?.error ?? '')
  check('второй раунд не начать', (await api('/play/mines/start', { bet: 1000, mines: 3 })).status === 409)

  let opened = 0
  let dead = false
  for (let cell = 0; cell < 25 && !dead && opened < 3; cell++) {
    const r = await api('/play/mines/open', { cell })
    if (r.status !== 200) { check('открытие клетки без ошибок', false, r.body?.error ?? ''); break }
    if (r.body.bomb) dead = true
    else opened++
  }
  if (!dead) {
    const repeat = await api('/play/mines/open', { cell: 0 })
    check('повторное открытие клетки отклонено', repeat.status === 400, repeat.body?.error ?? '')
    const cash = await api('/play/mines/cashout', {})
    check('вывод сработал', cash.status === 200 && cash.body.payout > 1000, `${cash.status} ${cash.body?.error ?? cash.body?.payout}`)
    check('множитель растёт с числом клеток', cash.body.mult > 1)
    check('после вывода раунда нет', (await api('/play/mines/cashout', {})).status === 409)
  } else {
    check('после взрыва раунда нет', (await api('/play/mines/cashout', {})).status === 409)
  }
}

console.log('\nБАШНЯ')
{
  const start = await api('/play/tower/start', { bet: 1000, bombs: 1 })
  check('раунд начат', start.status === 200, start.body?.error ?? '')
  const first = await api('/play/tower/pick', { col: 0 })
  check('ход принят', first.status === 200, first.body?.error ?? '')
  if (!first.body.dead) {
    const cash = await api('/play/tower/cashout', {})
    check('вывод сработал', cash.status === 200 && cash.body.payout > 1000, String(cash.body?.payout))
  } else {
    check('проигрыш закрыл раунд', (await api('/play/tower/cashout', {})).status === 409)
  }
}

console.log('\nКРАШ')
{
  const start = await api('/play/crash/start', { bet: 1000 })
  check('раунд начат', start.status === 200, start.body?.error ?? '')
  const greedy = await api('/play/crash/cashout', { at: 1000 })
  check('множитель из будущего отклонён', greedy.status === 400, greedy.body?.error ?? '')

  const out = await api('/play/crash/cashout', { at: 1.05 })
  check('вывод обработан', out.status === 200, out.body?.error ?? '')
  if (!out.body.crashed) {
    check('выплата по множителю', out.body.payout === Math.round(1000 * 1.05), String(out.body?.payout))
  }
  check('после закрытия раунда нет', (await api('/play/crash/cashout', { at: 1.05 })).status === 409)
  check('состояние пустое', (await api('/play/state')).body.rounds.length === 0)
}

console.log('\nБОНУСЫ')
{
  const w1 = await api('/play/wheel', {})
  check('колесо сыграно', w1.status === 200 && w1.body.outcome.payout > 0, String(w1.body?.outcome?.payout))
  const w2 = await api('/play/wheel', {})
  check('повторный спин колеса отклонён', w2.status === 400, w2.body?.error ?? '')

  const d1 = await api('/bonus/daily', {})
  check('ежедневный бонус выдан', d1.status === 200 && d1.body.amount > 0, String(d1.body?.amount))
  check('стрик начался с единицы', d1.body.streak === 1)
  check('повторный бонус отклонён', (await api('/bonus/daily', {})).status === 400)

  const r1 = await api('/bonus/rescue', {})
  check('страховка при большом балансе не выдаётся', r1.status === 400, r1.body?.error ?? '')
}

console.log('\nПРОМОКОДЫ')
{
  const before = (await me()).balance
  const r = await api('/promo', { code: 'max' })
  check('код принят без учёта регистра', r.status === 200 && r.body.amount === 500, r.body?.error ?? '')
  check('деньги зачислены', r.body.balance === before + 500)
  const again = await api('/promo', { code: 'MAX' })
  check('повторная активация отклонена', again.status === 400, again.body?.error ?? '')
  const bad = await api('/promo', { code: 'НЕТТАКОГО' })
  check('выдуманный код отклонён', bad.status === 400, bad.body?.error ?? '')

  const items = await api('/promo', { code: 'CAT' })
  check('предметный код выдал вещи', items.status === 200 && items.body.items.length === 3, String(items.body?.items?.length))
  const inv = (await me()).inventory.map((i: any) => i.uid)
  check('вещи лежат в инвентаре', items.body.items.every((i: any) => inv.includes(i.uid)))
}

console.log('\nДОСТИЖЕНИЯ')
{
  const profile = await me()
  check('выданы за сыгранное', profile.achievements.length > 0, profile.achievements.join(', '))
  check('первый апгрейд засчитан', profile.achievements.includes('first_spin'))
  check('распаковщик засчитан', profile.achievements.includes('case_1'))
  check('счётчик кейсов растёт', profile.stats.casesOpened >= 5, String(profile.stats.casesOpened))
}

console.log('\nЧЕСТНОСТЬ')
{
  const profile = await me()
  check('номер раунда вырос', profile.fair.nonce > 40, String(profile.fair.nonce))
  const rot = await api('/me/seed', {})
  check('сид можно сменить и проверить', typeof rot.body?.revealed?.serverSeed === 'string')
}

console.log(failures ? `\n${failures} проверок провалено` : '\nвсе проверки пройдены')
srv.kill()
process.exit(failures ? 1 : 0)
