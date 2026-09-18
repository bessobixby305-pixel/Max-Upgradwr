/** Чистая математика раундов — без базы, времени и сети.
 *  Один и тот же код крутится на сервере (источник истины) и на клиенте
 *  в офлайн-режиме, поэтому здесь не должно быть никаких побочных эффектов. */

import { hmacSha256Hex } from './sha256.js'

import { CASES, CaseDef, pickDrop } from './cases.js'
import { ITEM_BY_ID, ItemDef, nearestItem } from './items.js'
import { SLOT_SYMS, SlotSym, pickSym, slotPayout } from './slots.js'
import { MAX_MULT, MIN_MULT, UPGRADE_RTP, WHEEL_SECTORS } from './economy.js'

/** Реализация HMAC. По умолчанию — чистый JS, он нужен браузеру.
 *  На сервере подменяется нативной из node:crypto: результат тот же,
 *  но она в сотни раз быстрее, а раундов там миллионы. */
let hmacHex: (key: string, msg: string) => string = hmacSha256Hex

export function useFastHmac(fn: (key: string, msg: string) => string) {
  hmacHex = fn
}

// ——————————————————————————————————————————————————————— случайность

export interface Rng {
  /** Число в [0,1) для указанного курсора внутри одного раунда. */
  roll(cursor?: number): number
  /** Перестановка массива отдельным потоком чисел. */
  shuffle<T>(arr: T[], stream?: number): T[]
}

export function rngFor(serverSeed: string, clientSeed: string, nonce: number): Rng {
  const at = (cursor: number) =>
    parseInt(hmacHex(serverSeed, `${clientSeed}:${nonce}:${cursor}`).slice(0, 8), 16) / 0x100000000

  return {
    roll: (cursor = 0) => at(cursor),
    shuffle<T>(arr: T[], stream = 0): T[] {
      const out = arr.slice()
      // потоки разведены по курсорам, чтобы перестановки не пересекались
      // с обычными бросками того же раунда
      const base = 1_000_000 + stream * 1_000
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(at(base + i) * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
  }
}

// ——————————————————————————————————————————————————————— общие типы

export type GameId =
  | 'upgrade' | 'case' | 'dice' | 'double' | 'slots' | 'contract' | 'wheel'
  | 'mines' | 'tower' | 'crash'

export class GameError extends Error {}

/** Результат мгновенного раунда: либо деньги, либо предмет — не то и другое. */
export interface Outcome {
  win: boolean
  /** сколько зачислить на баланс */
  payout: number
  /** какой предмет выдать вместо денег */
  itemId?: string
  /** ценность выигрыша для статистики (для предмета — его цена) */
  value: number
  chance?: number
  mult?: number
  /** что показать в ленте и истории */
  detail: Record<string, unknown>
}

// ——————————————————————————————————————————————————————— апгрейд

export interface UpgradeBet { bet: number; mult?: number; targetId?: string }

export function upgradeChance(effMult: number) {
  return Math.min(0.95, UPGRADE_RTP / Math.max(MIN_MULT, effMult))
}

export function playUpgrade(rng: Rng, p: UpgradeBet): Outcome {
  const target = p.targetId ? ITEM_BY_ID[p.targetId] : undefined
  if (p.targetId && !target) throw new GameError('Нет такого предмета')

  const effMult = target ? target.price / Math.max(1, p.bet) : p.mult ?? 0
  if (!(effMult >= MIN_MULT) || effMult > MAX_MULT + 1e-9) {
    throw new GameError(`Множитель должен быть от ${MIN_MULT} до ${MAX_MULT}`)
  }

  const chance = upgradeChance(effMult)
  const roll = rng.roll()
  const win = roll < chance

  if (!win) {
    return { win: false, payout: 0, value: 0, chance, mult: effMult, detail: { roll, effMult } }
  }
  // Награда одна: либо MX на баланс, либо предмет в инвентарь.
  if (target) {
    return {
      win: true, payout: 0, itemId: target.id, value: target.price,
      chance, mult: effMult, detail: { roll, effMult, itemId: target.id },
    }
  }
  const payout = Math.round(p.bet * effMult)
  return { win: true, payout, value: payout, chance, mult: effMult, detail: { roll, effMult } }
}

// ——————————————————————————————————————————————————————— кейсы

export function caseById(id: string): CaseDef {
  const c = CASES.find((x) => x.id === id)
  if (!c) throw new GameError('Нет такого кейса')
  return c
}

export function playCase(rng: Rng, c: CaseDef): Outcome {
  const roll = rng.roll()
  const item: ItemDef = pickDrop(c, roll)
  return {
    win: item.price >= c.price,
    payout: 0,
    itemId: item.id,
    value: item.price,
    detail: { roll, caseId: c.id, itemId: item.id },
  }
}

// ——————————————————————————————————————————————————————— кости

export const DICE_RTP = 0.95
export const DICE_MIN_T = 2
export const DICE_MAX_T = 98

export function playDice(rng: Rng, p: { bet: number; target: number; over: boolean }): Outcome {
  const t = Math.round(p.target)
  if (!(t >= DICE_MIN_T && t <= DICE_MAX_T)) throw new GameError('Порог вне диапазона')

  const chance = (p.over ? 100 - t : t) / 100
  const mult = DICE_RTP / chance
  const roll = rng.roll()
  const v = Math.floor(roll * 10000) / 100
  const win = p.over ? v > t : v < t
  const payout = win ? Math.round(p.bet * mult) : 0
  return { win, payout, value: payout, chance, mult, detail: { roll, value: v, target: t, over: p.over } }
}

// ——————————————————————————————————————————————————————— дабл

export type DoubleColor = 'red' | 'black' | 'green'

/** 15 слотов: 7 красных, 7 чёрных, 1 зелёный. RTP = 14/15 ≈ 93.3%. */
export const DOUBLE_SLOTS: DoubleColor[] = [
  'green', 'red', 'black', 'red', 'black', 'red', 'black', 'red',
  'black', 'red', 'black', 'red', 'black', 'red', 'black',
]
export const DOUBLE_MULT: Record<DoubleColor, number> = { red: 2, black: 2, green: 14 }

export function playDouble(rng: Rng, p: { bet: number; pick: DoubleColor }): Outcome {
  if (!DOUBLE_MULT[p.pick]) throw new GameError('Неизвестный цвет')
  const roll = rng.roll()
  const idx = Math.min(DOUBLE_SLOTS.length - 1, Math.floor(roll * DOUBLE_SLOTS.length))
  const color = DOUBLE_SLOTS[idx]
  const win = color === p.pick
  const mult = DOUBLE_MULT[p.pick]
  const payout = win ? Math.round(p.bet * mult) : 0
  const chance = DOUBLE_SLOTS.filter((c) => c === p.pick).length / DOUBLE_SLOTS.length
  return { win, payout, value: payout, chance, mult, detail: { roll, idx, color } }
}

// ——————————————————————————————————————————————————————— слоты

export function playSlots(rng: Rng, p: { bet: number }): Outcome {
  const reels: SlotSym[] = [0, 1, 2].map((r) => pickSym(rng.roll(r)))
  const { mult, kind } = slotPayout(reels)
  const payout = Math.round(p.bet * mult)
  return {
    win: payout > 0,
    payout,
    value: payout,
    mult,
    detail: { reels: reels.map((s) => s.id), kind },
  }
}

export const SLOT_IDS = SLOT_SYMS.map((s) => s.id)

// ——————————————————————————————————————————————————————— контракт

export const CONTRACT_RTP = 0.9
export const CONTRACT_MIN = 3
export const CONTRACT_MAX = 10

/** Треугольное распределение вокруг ожидания: чаще средне, редко — джекпот. */
export function contractSpread(roll: number) {
  return roll < 0.5
    ? 0.25 + Math.sqrt(roll * 0.5) * 1.1
    : 0.8 + Math.pow((roll - 0.5) * 2, 3) * 2.7
}

export function playContract(rng: Rng, prices: number[]): Outcome {
  if (prices.length < CONTRACT_MIN || prices.length > CONTRACT_MAX) {
    throw new GameError(`В контракт идёт от ${CONTRACT_MIN} до ${CONTRACT_MAX} предметов`)
  }
  const sum = prices.reduce((s, x) => s + x, 0)
  const ev = Math.round(sum * CONTRACT_RTP)
  const roll = rng.roll()
  const item = nearestItem(Math.max(1, Math.round(ev * contractSpread(roll))))
  return {
    win: item.price >= sum,
    payout: 0,
    itemId: item.id,
    value: item.price,
    detail: { roll, sum, itemId: item.id },
  }
}

// ——————————————————————————————————————————————————————— колесо дня

const WHEEL_TOTAL = WHEEL_SECTORS.reduce((s, x) => s + x.weight, 0)

export function playWheel(rng: Rng): Outcome & { sector: number } {
  const roll = rng.roll()
  let acc = 0
  const t = roll * WHEEL_TOTAL
  let idx = WHEEL_SECTORS.length - 1
  for (let i = 0; i < WHEEL_SECTORS.length; i++) {
    acc += WHEEL_SECTORS[i].weight
    if (t < acc) { idx = i; break }
  }
  const value = WHEEL_SECTORS[idx].value
  return { win: true, payout: value, value, sector: idx, detail: { roll, sector: idx, value } }
}

// ——————————————————————————————————————————————————————— мины

export const MINES_SIZE = 25
export const MINES_RTP = 0.97

/** Множитель после k открытых безопасных клеток при m минах. */
export function minesMult(mines: number, opened: number) {
  if (opened === 0) return 1
  let mult = 1
  for (let i = 0; i < opened; i++) mult *= (MINES_SIZE - i) / (MINES_SIZE - mines - i)
  return mult * MINES_RTP
}

export function minesField(rng: Rng, mines: number): number[] {
  if (!(mines >= 1 && mines <= 24)) throw new GameError('Мин должно быть от 1 до 24')
  return rng.shuffle([...Array(MINES_SIZE).keys()]).slice(0, mines).sort((a, b) => a - b)
}

// ——————————————————————————————————————————————————————— башня

export const TOWER_FLOORS = 8
export const TOWER_COLS = 3
export const TOWER_RTP = 0.97

export function towerMult(bombs: number, floors: number) {
  return floors === 0 ? 1 : TOWER_RTP * Math.pow(TOWER_COLS / (TOWER_COLS - bombs), floors)
}

/** Для каждого этажа — отсортированный список безопасных колонок. */
export function towerRows(rng: Rng, bombs: number): number[][] {
  if (!(bombs >= 1 && bombs <= TOWER_COLS - 1)) throw new GameError('Мин в ряду: 1 или 2')
  const rows: number[][] = []
  for (let f = 0; f < TOWER_FLOORS; f++) {
    rows.push(rng.shuffle([0, 1, 2], f + 1).slice(bombs).sort((a, b) => a - b))
  }
  return rows
}

// ——————————————————————————————————————————————————————— краш

export const CRASH_EDGE = 0.05

/** Точка краша из честного числа: тяжёлый хвост, RTP ≈ 95%. */
export function crashPoint(roll: number) {
  if (roll < CRASH_EDGE) return 1
  return Math.max(1, Math.floor(((1 - CRASH_EDGE) / (1 - roll)) * 100) / 100)
}

/** Множитель через t секунд после старта — та же кривая, что рисует клиент. */
export function crashMultAt(seconds: number) {
  const t = Math.max(0, seconds)
  return Math.max(1, Math.floor(Math.pow(Math.E, 0.11 * t * (1 + t * 0.08)) * 100) / 100)
}

/** Обратная функция: за сколько секунд множитель дорастёт до m.
 *  Нужна, чтобы проверить, успел ли игрок нажать «забрать». */
export function crashTimeFor(mult: number) {
  if (mult <= 1) return 0
  // 0.11·t·(1+0.08t) = ln(m)  →  0.0088·t² + 0.11·t − ln(m) = 0
  const ln = Math.log(mult)
  return (-0.11 + Math.sqrt(0.11 * 0.11 + 4 * 0.0088 * ln)) / (2 * 0.0088)
}
