/** Расчёт ставки на сервере: списание, бросок, начисление и запись раунда —
 *  всё одной транзакцией. Клиент присылает только параметры ставки и
 *  получает готовый результат; повлиять на исход он не может. */

import type { Prisma } from '@prisma/client'
import { db, n } from './db.js'
import { activeSeed } from './fair.js'
import { GameError, GameId, Outcome, Rng, rngFor } from './core/games.js'
import { ACHIEVEMENTS, AchStats, levelFromXp, xpForBet } from './core/economy.js'
import { ITEM_BY_ID } from './core/items.js'

type Tx = Prisma.TransactionClient

export class PlayError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

/** Приращения статистики поверх тех, что считаются автоматически. */
export type StatBump = Partial<Record<
  'casesOpened' | 'minesCashouts' | 'crashCashouts' | 'contracts' | 'battlesWon' |
  'towerCashouts' | 'slotSpins' | 'slotJackpots' | 'doubleGreens' | 'diceWins' | 'jackpotWins',
  number
>> & { bestCrash?: number; towerBestFloor?: number }

export interface PlayResult {
  balance: number
  xp: number
  level: number
  outcome: Outcome
  item?: { uid: string; id: string; price: number }
  /** достижения, выданные этим раундом */
  unlocked: { id: string; name: string; emo: string; reward: number }[]
  fair: { serverSeedHash: string; clientSeed: string; nonce: number }
}

/** Снять ставку. Условие на баланс стоит в самом UPDATE, поэтому два
 *  параллельных запроса не могут списать больше, чем есть. */
export async function takeBet(tx: Tx, userId: string, bet: number) {
  if (!Number.isFinite(bet) || bet < 0 || bet > 1e15) throw new PlayError('Неверная ставка')
  const rounded = Math.floor(bet)
  if (rounded === 0) return
  const hit = await tx.profile.updateMany({
    where: { userId, balance: { gte: BigInt(rounded) } },
    data: { balance: { decrement: BigInt(rounded) }, totalWagered: { increment: BigInt(rounded) } },
  })
  if (hit.count !== 1) throw new PlayError('Недостаточно MX')
}

/** Взять следующий номер раунда в цепочке честности. */
export async function nextNonce(tx: Tx, seedId: string) {
  const seed = await tx.seed.update({ where: { id: seedId }, data: { nonce: { increment: 1 } } })
  return seed
}

/** Начислить выигрыш, обновить статистику, выдать предмет и записать раунд. */
export async function applyOutcome(
  tx: Tx,
  o: {
    userId: string; game: GameId; bet: number; seedId: string; nonce: number
    outcome: Outcome; bump?: StatBump; countSpin?: boolean; source?: string
  },
): Promise<{ balance: number; xp: number; item?: { uid: string; id: string; price: number } }> {
  const { userId, outcome } = o
  const payout = Math.max(0, Math.floor(outcome.payout))
  const itemPrice = outcome.itemId ? ITEM_BY_ID[outcome.itemId]?.price ?? 0 : 0
  const xpGain = o.bet > 0 ? xpForBet(o.bet) : 0

  const profile = await tx.profile.update({
    where: { userId },
    data: {
      balance: { increment: BigInt(payout) },
      xp: { increment: xpGain },
      spins: { increment: o.countSpin === false ? 0 : 1 },
      wins: { increment: outcome.win ? 1 : 0 },
      losses: { increment: outcome.win ? 0 : 1 },
      totalWon: { increment: BigInt(Math.max(0, Math.floor(outcome.value))) },
      // счётчики прибавляются, «рекорды» ниже обновляются отдельно
      ...Object.fromEntries(
        Object.entries(o.bump ?? {})
          .filter(([k]) => k !== 'bestCrash' && k !== 'towerBestFloor')
          .map(([k, v]) => [k, { increment: v as number }]),
      ),
    },
  })

  // «рекордные» поля растут только вверх
  const records: Prisma.ProfileUpdateInput = {}
  const newBalance = profile.balance
  if (newBalance > profile.maxBalance) records.maxBalance = newBalance
  if (outcome.value > n(profile.biggestWin)) records.biggestWin = BigInt(Math.floor(outcome.value))
  if (outcome.mult && outcome.mult > profile.bestMult) records.bestMult = outcome.mult
  if (itemPrice > profile.bestItemPrice) records.bestItemPrice = itemPrice
  if (o.bump?.bestCrash && o.bump.bestCrash > profile.bestCrash) records.bestCrash = o.bump.bestCrash
  if (o.bump?.towerBestFloor && o.bump.towerBestFloor > profile.towerBestFloor) {
    records.towerBestFloor = o.bump.towerBestFloor
  }
  const fresh = Object.keys(records).length
    ? await tx.profile.update({ where: { userId }, data: records })
    : profile

  let item: { uid: string; id: string; price: number } | undefined
  if (outcome.itemId) {
    const row = await tx.item.create({
      data: { userId, itemId: outcome.itemId, price: itemPrice, source: o.source ?? o.game },
    })
    item = { uid: row.id, id: outcome.itemId, price: itemPrice }
  }

  await tx.round.create({
    data: {
      userId, seedId: o.seedId, game: o.game, nonce: o.nonce,
      bet: BigInt(Math.floor(o.bet)),
      payout: BigInt(payout + itemPrice),
      roll: Number(outcome.detail.roll ?? 0),
      chance: outcome.chance ?? null,
      mult: outcome.mult ?? null,
      itemId: outcome.itemId ?? null,
    },
  })

  return { balance: n(fresh.balance), xp: fresh.xp, item }
}

/** Проверить достижения по серверной статистике и выдать награды. */
export async function grantAchievements(tx: Tx, userId: string) {
  const [profile, itemsOwned, promosUsed] = await Promise.all([
    tx.profile.findUniqueOrThrow({ where: { userId } }),
    tx.item.count({ where: { userId } }),
    tx.promoUse.count({ where: { userId } }),
  ])

  const stats: AchStats = {
    spins: profile.spins, wins: profile.wins, losses: profile.losses,
    bestMult: profile.bestMult, biggestWin: n(profile.biggestWin),
    casesOpened: profile.casesOpened, itemsOwned, bestItemPrice: profile.bestItemPrice,
    maxBalance: n(profile.maxBalance), minesCashouts: profile.minesCashouts,
    crashCashouts: profile.crashCashouts, bestCrash: profile.bestCrash,
    contracts: profile.contracts, battlesWon: profile.battlesWon,
    totalWagered: n(profile.totalWagered), level: levelFromXp(profile.xp).lvl,
    streak: profile.dailyStreak, promosUsed,
    towerCashouts: profile.towerCashouts, towerBestFloor: profile.towerBestFloor,
    slotSpins: profile.slotSpins, slotJackpots: profile.slotJackpots,
    doubleGreens: profile.doubleGreens, diceWins: profile.diceWins,
    jackpotWins: profile.jackpotWins,
  }

  const have = new Set(profile.achievements)
  const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(stats))
  if (!fresh.length) return { unlocked: [], balance: n(profile.balance) }

  const reward = fresh.reduce((s, a) => s + a.reward, 0)
  const after = await tx.profile.update({
    where: { userId },
    data: {
      achievements: { push: fresh.map((a) => a.id) },
      balance: { increment: BigInt(reward) },
    },
  })
  if (after.balance > after.maxBalance) {
    await tx.profile.update({ where: { userId }, data: { maxBalance: after.balance } })
  }
  return {
    unlocked: fresh.map((a) => ({ id: a.id, name: a.name, emo: a.emo, reward: a.reward })),
    balance: n(after.balance),
  }
}

/** Полный цикл мгновенной игры. */
export async function playRound(o: {
  userId: string
  game: GameId
  bet: number
  run: (rng: Rng) => Outcome
  bump?: StatBump
  /** дополнительные приращения, зависящие от исхода */
  bumpFor?: (out: Outcome) => StatBump
  source?: string
}): Promise<PlayResult> {
  const seed = await activeSeed(o.userId)

  return db.$transaction(async (tx) => {
    await takeBet(tx, o.userId, o.bet)
    const bumped = await nextNonce(tx, seed.id)
    const rng = rngFor(bumped.serverSeed, bumped.clientSeed, bumped.nonce)

    let outcome: Outcome
    try {
      outcome = o.run(rng)
    } catch (e) {
      if (e instanceof GameError) throw new PlayError(e.message)
      throw e
    }

    const bump = { ...(o.bump ?? {}), ...(o.bumpFor?.(outcome) ?? {}) }
    const applied = await applyOutcome(tx, {
      userId: o.userId, game: o.game, bet: o.bet, seedId: seed.id,
      nonce: bumped.nonce, outcome, bump, source: o.source,
    })
    const ach = await grantAchievements(tx, o.userId)

    return {
      balance: ach.unlocked.length ? ach.balance : applied.balance,
      xp: applied.xp,
      level: levelFromXp(applied.xp).lvl,
      outcome,
      item: applied.item,
      unlocked: ach.unlocked,
      fair: { serverSeedHash: bumped.serverSeedHash, clientSeed: bumped.clientSeed, nonce: bumped.nonce },
    }
  })
}
