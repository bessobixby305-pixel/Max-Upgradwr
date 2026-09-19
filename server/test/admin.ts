/** Админка: права, выдача, промокоды, баны, журнал. */
import { spawn } from 'node:child_process'

// порт случайный: так прогон никогда не попадёт на чужой сервер
const PORT = String(20000 + Math.floor(Math.random() * 20000))
const BASE = `http://127.0.0.1:${PORT}`
const CODE = 'секретный-админ-код-для-теста'
let failures = 0
const check = (label: string, cond: boolean, extra = '') => {
  if (!cond) failures++
  console.log(`  ${cond ? '✓' : '✗ ОШИБКА'} ${label}${extra ? '  ' + extra : ''}`)
}

const srv = spawn('npx', ['tsx', 'src/index.ts'], {
  env: { ...process.env, PORT, LOG_LEVEL: 'silent', ADMIN_CODE: CODE },
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

async function player(tag: string) {
  const login = `${tag}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
  const reg = await call('/auth/register', '', { login, password: 'secret123' })
  return { login, token: reg.body.access as string, refresh: reg.body.refresh as string }
}

const boss = await player('boss')
const guy = await player('guy')
const guyId = async () => {
  const list = await call(`/admin/users?q=${guy.login}`, boss.token)
  return list.body.users[0].userId as string
}

console.log('ПРАВА')
{
  check('обычный игрок в сводку не попадает', (await call('/admin/stats', guy.token)).status === 403)
  check('без токена тоже нельзя', (await call('/admin/stats', '')).status === 401)
  const wrong = await call('/admin/claim', boss.token, { code: 'не тот код' })
  check('неверный админ-код отклонён', wrong.status === 403, wrong.body?.error ?? '')

  const ok = await call('/admin/claim', boss.token, { code: CODE })
  check('верный код выдал права', ok.status === 200 && ok.body.relogin === true, ok.body?.error ?? '')
  // роль в старом токене ещё игрок — сервер обязан сверяться с базой
  check('старый токен уже пускает в админку', (await call('/admin/stats', boss.token)).status === 200)
}

console.log('\nСВОДКА')
{
  const s = await call('/admin/stats', boss.token)
  check('игроки посчитаны', s.body.users >= 2, String(s.body?.users))
  check('общий баланс посчитан', s.body.balanceTotal >= 2000, String(s.body?.balanceTotal))
  check('есть список богатейших', Array.isArray(s.body.top))
  check('есть последние раунды', Array.isArray(s.body.recent))
}

console.log('\nВЫДАЧА ДЕНЕГ')
{
  const id = await guyId()
  const before = (await call('/me', guy.token)).body.balance
  const give = await call(`/admin/users/${id}/balance`, boss.token, { amount: 50_000, note: 'за красивые глаза' })
  check('деньги выданы', give.status === 200 && give.body.balance === before + 50_000, String(give.body?.balance))

  const take = await call(`/admin/users/${id}/balance`, boss.token, { amount: -1e12 })
  check('списание не уводит в минус', take.status === 200 && take.body.balance === 0, String(take.body?.balance))
  check('списали ровно столько, сколько было', take.body.applied === -(before + 50_000), String(take.body?.applied))

  const nobody = await call('/admin/users/нет-такого/balance', boss.token, { amount: 10 })
  check('несуществующий игрок отклонён', nobody.status === 404)
}

console.log('\nВЫДАЧА ПРЕДМЕТОВ')
{
  const id = await guyId()
  const before = (await call('/me', guy.token)).body.inventory.length
  const give = await call(`/admin/users/${id}/items`, boss.token, { items: ['gift_crown', 'max_itself'] })
  check('предметы выданы', give.status === 200 && give.body.given === 2, String(give.body?.given))
  check('лежат в инвентаре', (await call('/me', guy.token)).body.inventory.length === before + 2)
  check('выдуманный предмет отклонён', (await call(`/admin/users/${id}/items`, boss.token, { items: ['нет'] })).status === 400)
}

console.log('\nПРОМОКОДЫ')
{
  // коды остаются в базе между прогонами — берём уникальные
  const DROP = 'TESTDROP' + Math.floor(Math.random() * 1e6)
  const REV = 'REVOKEME' + Math.floor(Math.random() * 1e6)
  const made = await call('/admin/promos', boss.token, {
    code: DROP, amount: 7777, items: ['gift_cake'], maxUses: 1, note: 'разовый',
  })
  check('код создан', made.status === 200 && made.body.code === DROP, made.body?.error ?? '')
  check('дубликат отклонён', (await call('/admin/promos', boss.token, { code: DROP, amount: 1 })).status === 409)
  check('пустой код отклонён', (await call('/admin/promos', boss.token, { code: 'EMPTY' + Math.floor(Math.random() * 1e6) })).status === 400)
  check('кириллица в коде отклонена', (await call('/admin/promos', boss.token, { code: 'КОДИК', amount: 5 })).status === 400)

  const before = (await call('/me', guy.token)).body.balance
  const used = await call('/promo', guy.token, { code: DROP.toLowerCase() })
  check('игрок активировал код', used.status === 200 && used.body.amount === 7777, used.body?.error ?? '')
  check('деньги и предмет пришли', used.body.balance === before + 7777 && used.body.items.length === 1)

  const second = await call('/promo', boss.token, { code: DROP })
  check('лимит активаций соблюдён', second.status === 400, second.body?.error ?? '')

  const rev = await call('/admin/promos', boss.token, { code: REV, amount: 100 })
  const promoId = rev.body.id
  await call(`/admin/promos/${promoId}/revoke`, boss.token, {})
  const dead = await call('/promo', guy.token, { code: REV })
  check('отозванный код не работает', dead.status === 400, dead.body?.error ?? '')

  const list = await call('/admin/promos', boss.token)
  check('коды видны в списке', list.body.promos.some((p: any) => p.code === DROP))
  check('счётчик активаций растёт', list.body.promos.find((p: any) => p.code === DROP).usedCount === 1)
}

console.log('\nБАНЫ')
{
  const id = await guyId()
  const ban = await call(`/admin/users/${id}/ban`, boss.token, { banned: true, reason: 'накрутка' })
  check('игрок забанен', ban.status === 200 && ban.body.banned === true, ban.body?.error ?? '')
  check('вход забаненному закрыт',
    (await call('/auth/login', '', { login: guy.login, password: 'secret123' })).status === 403)
  check('сессия погашена', (await call('/auth/refresh', '', { refresh: guy.refresh })).status === 401)

  const self = await call(`/admin/users/${(await call('/admin/users?q=' + boss.login, boss.token)).body.users[0].userId}/ban`,
    boss.token, { banned: true })
  check('себя забанить нельзя', self.status === 400, self.body?.error ?? '')

  await call(`/admin/users/${id}/ban`, boss.token, { banned: false })
  check('разбан вернул вход',
    (await call('/auth/login', '', { login: guy.login, password: 'secret123' })).status === 200)
}

console.log('\nЖУРНАЛ')
{
  const log = await call('/admin/log', boss.token)
  const actions = log.body.entries.map((e: any) => e.action)
  check('записаны выдачи денег', actions.includes('balance'))
  check('записаны баны', actions.includes('ban') && actions.includes('unban'))
  check('записано создание кода', actions.includes('promo.create'))
  check('записан отзыв кода', actions.includes('promo.revoke'))
  check('виден автор действия', log.body.entries.every((e: any) => !!e.admin))
}

console.log(failures ? `\n${failures} проверок провалено` : '\nвсе проверки пройдены')
srv.kill()
process.exit(failures ? 1 : 0)
