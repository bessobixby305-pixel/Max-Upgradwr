/** Проверка сервера по-настоящему: поднимаем процесс, бьём в HTTP. */
import { spawn } from 'node:child_process'

const BASE = 'http://127.0.0.1:3111'
const ok = (c: boolean) => (c ? '✓' : '✗ ОШИБКА')
let failures = 0
const check = (label: string, cond: boolean, extra = '') => {
  if (!cond) failures++
  console.log(`  ${ok(cond)} ${label}${extra ? '  ' + extra : ''}`)
}

const srv = spawn('npx', ['tsx', 'src/index.ts'], {
  env: { ...process.env, PORT: '3111', LOG_LEVEL: 'silent' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
srv.stderr.on('data', (d) => { const s = String(d); if (s.includes('Error')) console.error(s) })
// иначе упавший тест оставит сервер висеть на порту, и следующий прогон
// будет разговаривать со старым процессом
process.on('exit', () => srv.kill())
process.on('uncaughtException', (e) => { console.error(e); srv.kill(); process.exit(1) })
process.on('unhandledRejection', (e) => { console.error(e); srv.kill(); process.exit(1) })

const api = async (path: string, init?: RequestInit & { token?: string }) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (init?.token) headers.authorization = `Bearer ${init.token}`
  const res = await fetch(BASE + path, { ...init, headers })
  return { status: res.status, body: await res.json().catch(() => null) as any }
}

// ждём старта
for (let i = 0; i < 60; i++) {
  try { await fetch(BASE + '/health'); break } catch { await new Promise((r) => setTimeout(r, 400)) }
}

const login = 'tester_' + Date.now().toString(36)

console.log('ЗДОРОВЬЕ')
check('GET /health', (await api('/health')).body?.ok === true)

console.log('\nРЕГИСТРАЦИЯ')
const short = await api('/auth/register', { method: 'POST', body: JSON.stringify({ login: 'ab', password: 'secret123' }) })
check('короткий логин отклонён', short.status === 400, short.body?.error ?? '')
const weak = await api('/auth/register', { method: 'POST', body: JSON.stringify({ login, password: '123' }) })
check('короткий пароль отклонён', weak.status === 400)
const bad = await api('/auth/register', { method: 'POST', body: JSON.stringify({ login: 'плохой-ник', password: 'secret123' }) })
check('кириллица в логине отклонена', bad.status === 400)

const reg = await api('/auth/register', { method: 'POST', body: JSON.stringify({ login, password: 'secret123' }) })
check('регистрация проходит', reg.status === 200 && !!reg.body.access)
const dup = await api('/auth/register', { method: 'POST', body: JSON.stringify({ login, password: 'secret123' }) })
check('повторный логин занят', dup.status === 409)

let access: string = reg.body.access
let refresh: string = reg.body.refresh

console.log('\nПРОФИЛЬ')
const anon = await api('/me')
check('без токена 401', anon.status === 401)
const me = await api('/me', { token: access })
check('баланс по умолчанию 1000', me.body?.balance === 1000, String(me.body?.balance))
check('есть хэш серверного сида', typeof me.body?.fair?.serverSeedHash === 'string' && me.body.fair.serverSeedHash.length === 64)
check('инвентарь пуст', Array.isArray(me.body?.inventory) && me.body.inventory.length === 0)

console.log('\nВХОД')
const wrong = await api('/auth/login', { method: 'POST', body: JSON.stringify({ login, password: 'wrong123' }) })
check('неверный пароль 401', wrong.status === 401)
const nouser = await api('/auth/login', { method: 'POST', body: JSON.stringify({ login: 'nosuchuser_x', password: 'secret123' }) })
check('несуществующий логин отвечает так же', nouser.status === 401 && nouser.body.error === wrong.body.error)
const li = await api('/auth/login', { method: 'POST', body: JSON.stringify({ login, password: 'secret123' }) })
check('вход проходит', li.status === 200 && !!li.body.access)

console.log('\nОБНОВЛЕНИЕ СЕССИИ')
const ref = await api('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh }) })
check('refresh выдаёт новую пару', ref.status === 200 && !!ref.body.access && ref.body.refresh !== refresh)
const reuse = await api('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh }) })
check('старый refresh больше не работает', reuse.status === 401)
refresh = ref.body.refresh
access = ref.body.access

console.log('\nПЕРЕНОС ПРОГРЕССА')
const imp = await api('/me/import', {
  method: 'POST', token: access,
  body: JSON.stringify({ balance: 478000, xp: 26538, inventory: [{ id: 'verify_blue', price: 18500 }, { id: 'gift_crown', price: 280000 }] }),
})
check('перенос принят', imp.status === 200 && imp.body.balance === 478000, String(imp.body?.balance))
check('предметы перенеслись', imp.body?.inventory?.length === 2)
const imp2 = await api('/me/import', {
  method: 'POST', token: access,
  body: JSON.stringify({ balance: 999999, xp: 0, inventory: [] }),
})
check('повторный перенос отклонён', imp2.status === 409, imp2.body?.error ?? '')
const negative = await api('/me/import', { method: 'POST', token: access, body: JSON.stringify({ balance: -5, xp: 0, inventory: [] }) })
check('отрицательный баланс отклонён', negative.status === 400)

console.log('\nЧЕСТНАЯ ИГРА')
const before = (await api('/me', { token: access })).body.fair.serverSeedHash
const rot = await api('/me/seed', { method: 'POST', token: access, body: JSON.stringify({ clientSeed: 'мой-сид' }) })
check('старый сид раскрыт', typeof rot.body?.revealed?.serverSeed === 'string')
check('хэш раскрытого совпадает с прежним', rot.body?.revealed?.hash === before)
check('выдан новый хэш', rot.body?.fair?.serverSeedHash !== before)
check('клиентский сид применился', rot.body?.fair?.clientSeed === 'мой-сид')

console.log('\nЗАВЕРШЕНИЕ СЕССИИ')
await api('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh }) })
const afterOut = await api('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh }) })
check('после выхода refresh не работает', afterOut.status === 401)

console.log(failures ? `\n${failures} проверок провалено` : '\nвсе проверки пройдены')
srv.kill()
process.exit(failures ? 1 : 0)
