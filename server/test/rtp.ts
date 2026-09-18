/** Проверка математики раундов: отдача каждой игры на большой выборке.
 *  Сервер теперь единственный источник исходов, поэтому цифры должны
 *  сходиться именно здесь, а не на глаз в интерфейсе.
 *
 *  Допуск не берётся с потолка: по выборке считается стандартная ошибка
 *  среднего, и эмпирика должна укладываться в четыре сигмы от точного
 *  значения. Иначе тест на редких событиях (джекпот в слотах, вывод на
 *  x20 в краше) мигал бы через раз. */

import '../src/fasthmac.js'
import { createHmac, randomBytes } from 'node:crypto'
import { hmacSha256Hex } from '../src/core/sha256.js'
import {
  DOUBLE_SLOTS, crashMultAt, crashPoint, crashTimeFor,
  minesField, minesMult, playCase, playContract, playDice, playDouble,
  playSlots, playUpgrade, playWheel, rngFor, towerMult, towerRows,
} from '../src/core/games.js'
import { CASES, caseRtp } from '../src/core/cases.js'
import { ITEM_BY_ID, sortedByPrice } from '../src/core/items.js'
import { slotsRtp } from '../src/core/slots.js'
import { WHEEL_SECTORS } from '../src/core/economy.js'

let failures = 0
const check = (label: string, cond: boolean, extra = '') => {
  if (!cond) failures++
  console.log(`  ${cond ? '✓' : '✗ ОШИБКА'} ${label}${extra ? '  ' + extra : ''}`)
}
const pct = (x: number) => (x * 100).toFixed(2) + '%'

/** Независимая цепочка бросков: каждый раунд — свой nonce. */
function chain() {
  const serverSeed = randomBytes(32).toString('hex')
  const clientSeed = randomBytes(8).toString('hex')
  let nonce = 0
  return () => rngFor(serverSeed, clientSeed, ++nonce)
}

/** Прогнать серию раундов и сверить отдачу с точным значением. */
function rtp(label: string, exact: number, runs: number, round: (i: number) => number) {
  let sum = 0
  let sumSq = 0
  for (let i = 0; i < runs; i++) {
    const x = round(i)
    sum += x
    sumSq += x * x
  }
  const mean = sum / runs
  const sigma = Math.sqrt(Math.max(0, sumSq / runs - mean * mean) / runs)
  const off = Math.abs(mean - exact)
  check(
    label,
    off <= 4 * sigma + 1e-4,
    `набрано ${pct(mean)}, точно ${pct(exact)}, отклонение ${(off / (sigma || 1e-9)).toFixed(1)}σ`,
  )
}

const N = 200_000
const BET = 1000

console.log('РЕАЛИЗАЦИИ HMAC')
{
  // сервер считает нативным крипто, браузер — чистым JS: числа должны совпасть
  const same = ['a', 'сид:1:0', 'x'.repeat(200)].every(
    (m) => hmacSha256Hex('ключ', m) === createHmac('sha256', 'ключ').update(m, 'utf8').digest('hex'),
  )
  check('чистый JS и node:crypto дают одно и то же', same)
}

console.log('\nРАВНОМЕРНОСТЬ БРОСКА')
{
  const next = chain()
  const buckets = new Array(10).fill(0)
  for (let i = 0; i < N; i++) buckets[Math.floor(next().roll() * 10)]++
  const worst = Math.max(...buckets.map((b) => Math.abs(b / N - 0.1)))
  check('десятые доли распределены ровно', worst < 0.003, '±' + pct(worst))

  const one = rngFor('seed', 'client', 1)
  check('курсоры дают разные числа', one.roll(0) !== one.roll(1) && one.roll(1) !== one.roll(2))
}

console.log('\nАПГРЕЙД')
for (const mult of [1.5, 2, 5, 25, 50]) {
  const next = chain()
  rtp(`x${mult}`, 0.92, N, () => playUpgrade(next(), { bet: BET, mult }).payout / BET)
}
{
  const next = chain()
  const target = ITEM_BY_ID['gift_heart']
  const bet = Math.round(target.price / 3)
  // выплата уходит вещью — считаем её цену
  rtp('на предмет', 0.92, N, () => playUpgrade(next(), { bet, targetId: target.id }).value / bet)
}

console.log('\nКЕЙСЫ')
for (const c of CASES) {
  const next = chain()
  const exact = caseRtp(c)
  check(`${c.name}: точный RTP в коридоре 88–94%`, exact >= 0.88 && exact <= 0.94, pct(exact))
  rtp(`${c.name} на выборке`, exact, 60_000, () => playCase(next(), c).value / c.price)
}

console.log('\nКОСТИ')
for (const [target, over] of [[50, true], [90, true], [10, false], [75, false]] as const) {
  const next = chain()
  rtp(`${over ? '>' : '<'} ${target}`, 0.95, N, () => playDice(next(), { bet: BET, target, over }).payout / BET)
}

console.log('\nДАБЛ')
{
  const exact = (DOUBLE_SLOTS.filter((c) => c === 'red').length / DOUBLE_SLOTS.length) * 2
  check('точный RTP красного', Math.abs(exact - 14 / 15) < 1e-9, pct(exact))
  for (const pick of ['red', 'black', 'green'] as const) {
    const next = chain()
    rtp(pick, 14 / 15, N, () => playDouble(next(), { bet: BET, pick }).payout / BET)
  }
}

console.log('\nСЛОТЫ')
{
  const exact = slotsRtp()
  check('точный RTP набора', Math.abs(exact - 0.922) < 0.005, pct(exact))
  const next = chain()
  rtp('на выборке', exact, N, () => playSlots(next(), { bet: BET }).payout / BET)
}

console.log('\nКОНТРАКТ')
{
  const next = chain()
  const prices = [ITEM_BY_ID['gift_flower'].price, ITEM_BY_ID['gift_candy'].price, ITEM_BY_ID['reaction'].price]
  const sum = prices.reduce((s, x) => s + x, 0)
  let value = 0
  const runs = 60_000
  for (let i = 0; i < runs; i++) value += playContract(next(), prices).value
  const got = value / (runs * sum)
  // результат прыгает по ценам каталога, точного значения нет — только коридор
  check('отдача в коридоре 80–100%', got > 0.8 && got < 1.0, pct(got))
  const drawn = Array.from({ length: 200 }, () => playContract(next(), prices).itemId)
  const known = new Set(sortedByPrice.map((x) => x.id))
  check('результат всегда из каталога', drawn.every((id) => !!id && known.has(id)))
}

console.log('\nКОЛЕСО ДНЯ')
{
  const total = WHEEL_SECTORS.reduce((s, x) => s + x.weight, 0)
  const exact = WHEEL_SECTORS.reduce((s, x) => s + (x.weight / total) * x.value, 0)
  const next = chain()
  rtp('средний выигрыш', 1, N, () => playWheel(next()).payout / exact)
}

console.log('\nМИНЫ')
for (const [mines, open] of [[3, 3], [5, 2], [10, 1], [24, 1]] as const) {
  const next = chain()
  rtp(`${mines} мин, ${open} клеток`, 0.97, 120_000, () => {
    const bombs = new Set(minesField(next(), mines))
    // стратегия: открываем первые клетки подряд и забираем
    for (let c = 0; c < open; c++) if (bombs.has(c)) return 0
    return minesMult(mines, open)
  })
}
check('мин ровно столько, сколько просили', minesField(rngFor('a', 'b', 1), 7).length === 7)

console.log('\nБАШНЯ')
for (const [bombs, floors] of [[1, 3], [1, 8], [2, 2]] as const) {
  const next = chain()
  rtp(`${bombs} мин, ${floors} этажей`, 0.97, 120_000, () => {
    const rows = towerRows(next(), bombs)
    // стратегия: всегда жмём левую колонку
    for (let f = 0; f < floors; f++) if (!rows[f].includes(0)) return 0
    return towerMult(bombs, floors)
  })
}
{
  const rows = towerRows(rngFor('a', 'b', 1), 2)
  check('на этаже остаётся одна безопасная клетка', rows.every((r) => r.length === 1))
}

console.log('\nКРАШ')
{
  // Точка краша округляется вниз до сотых, поэтому дожить до x означает
  // 0.95/(1-roll) ≥ x + 0.01. Отсюда и вероятности, и точный RTP.
  const survive = (m: number) => 0.95 / (m + 0.01)
  for (const at of [1.5, 2, 5, 20]) {
    const next = chain()
    rtp(`вывод на x${at}`, 0.95 * (at / (at + 0.01)), N, () => (crashPoint(next().roll()) > at ? at : 0))
  }

  const next = chain()
  const instant = 1 - survive(1)
  let hits = 0
  for (let i = 0; i < N; i++) if (crashPoint(next().roll()) === 1) hits++
  const sigma = Math.sqrt((instant * (1 - instant)) / N)
  check(
    'доля мгновенных крашей совпадает с формулой',
    Math.abs(hits / N - instant) <= 4 * sigma,
    `набрано ${pct(hits / N)}, точно ${pct(instant)}`,
  )

  const worst = [1.2, 2, 5, 20, 100].reduce(
    (m, x) => Math.max(m, Math.abs(crashMultAt(crashTimeFor(x)) - x) / x), 0,
  )
  check('время до множителя считается точно', worst < 0.01, '±' + pct(worst))
}

console.log(failures ? `\n${failures} проверок провалено` : '\nвся математика сходится')
process.exit(failures ? 1 : 0)
