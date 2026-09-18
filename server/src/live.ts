/** Игры с продолжением: мины, башня, краш.
 *  Раскладка генерируется на сервере при старте и клиенту не показывается —
 *  он узнаёт только то, что открыл сам. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, n } from './db.js'
import { readAuth } from './profile.js'
import { PlayError, applyOutcome, grantAchievements, nextNonce, takeBet } from './settle.js'
import { activeSeed } from './fair.js'
import {
  GameError, MINES_SIZE, Outcome, TOWER_FLOORS,
  crashMultAt, crashPoint, crashTimeFor, minesField, minesMult, rngFor, towerMult, towerRows,
} from './core/games.js'
import { levelFromXp } from './core/economy.js'

type LiveGame = 'mines' | 'tower' | 'crash'

interface MinesSecret { mines: number; bombs: number[] }
interface TowerSecret { bombs: number; rows: number[][] }
interface CrashSecret { point: number; autoAt?: number }

/** Небольшой запас на задержку сети при проверке «успел ли забрать». */
const CRASH_GRACE_MS = 1500

async function findLive(userId: string, game: LiveGame) {
  return db.liveRound.findFirst({ where: { userId, game, endedAt: null }, orderBy: { startedAt: 'desc' } })
}

/** Закрыть раунд и рассчитаться. */
async function finish(
  userId: string,
  round: { id: string; game: string; bet: bigint; seedId: string; nonce: number },
  outcome: Outcome,
  bump?: Parameters<typeof applyOutcome>[1]['bump'],
) {
  return db.$transaction(async (tx) => {
    const closed = await tx.liveRound.updateMany({
      where: { id: round.id, endedAt: null },
      data: { endedAt: new Date() },
    })
    // кто-то уже закрыл этот раунд параллельным запросом
    if (closed.count !== 1) throw new PlayError('Раунд уже завершён', 409)

    const applied = await applyOutcome(tx, {
      userId, game: round.game as LiveGame, bet: n(round.bet),
      seedId: round.seedId, nonce: round.nonce, outcome, bump,
    })
    const ach = await grantAchievements(tx, userId)
    return {
      balance: ach.unlocked.length ? ach.balance : applied.balance,
      xp: applied.xp,
      level: levelFromXp(applied.xp).lvl,
      outcome,
      unlocked: ach.unlocked,
    }
  })
}

/** Начать раунд: снять ставку, взять номер в цепочке, разложить поле. */
async function begin(userId: string, game: LiveGame, bet: number, make: (rng: ReturnType<typeof rngFor>) => {
  secret: unknown; progress: unknown
}) {
  const existing = await findLive(userId, game)
  if (existing) throw new PlayError('Предыдущий раунд ещё не закрыт', 409)

  const seed = await activeSeed(userId)
  return db.$transaction(async (tx) => {
    await takeBet(tx, userId, bet)
    const bumped = await nextNonce(tx, seed.id)
    const rng = rngFor(bumped.serverSeed, bumped.clientSeed, bumped.nonce)

    let made
    try {
      made = make(rng)
    } catch (e) {
      if (e instanceof GameError) throw new PlayError(e.message)
      throw e
    }

    const row = await tx.liveRound.create({
      data: {
        userId, seedId: seed.id, game, nonce: bumped.nonce,
        bet: BigInt(Math.floor(bet)),
        secret: made.secret as object,
        progress: made.progress as object,
      },
    })
    const profile = await tx.profile.findUniqueOrThrow({ where: { userId } })
    return { roundId: row.id, balance: n(profile.balance), startedAt: row.startedAt.getTime() }
  })
}

/** Краш, который давно взорвался, но остался открытым (клиент закрыли). */
async function settleExpiredCrash(userId: string) {
  const round = await findLive(userId, 'crash')
  if (!round) return null
  const secret = round.secret as unknown as CrashSecret
  const elapsed = (Date.now() - round.startedAt.getTime()) / 1000
  if (elapsed <= crashTimeFor(secret.point)) return round

  await finish(userId, round, {
    win: false, payout: 0, value: 0,
    detail: { point: secret.point, reason: 'expired' },
  }).catch(() => undefined)
  return null
}

export function liveRoutes(app: FastifyInstance, secret: string) {
  const route = <S extends z.ZodTypeAny>(
    path: string,
    schema: S,
    run: (userId: string, body: z.infer<S>) => Promise<unknown>,
  ) => {
    app.post(path, async (req, reply) => {
      const auth = readAuth(req, secret)
      if (!auth) return reply.code(401).send({ error: 'Нужен вход' })
      const parsed = schema.safeParse(req.body ?? {})
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message })
      try {
        return await run(auth.userId, parsed.data)
      } catch (e) {
        if (e instanceof PlayError) return reply.code(e.status).send({ error: e.message })
        if (e instanceof GameError) return reply.code(400).send({ error: e.message })
        throw e
      }
    })
  }

  // ——————————————————————————————— мины

  route('/play/mines/start', z.object({
    bet: z.number().int().min(1).max(1e12),
    mines: z.number().int().min(1).max(24),
  }), (userId, b) =>
    begin(userId, 'mines', b.bet, (rng) => ({
      secret: { mines: b.mines, bombs: minesField(rng, b.mines) } satisfies MinesSecret,
      progress: { opened: [] as number[] },
    })),
  )

  route('/play/mines/open', z.object({ cell: z.number().int().min(0).max(MINES_SIZE - 1) }), async (userId, b) => {
    const round = await findLive(userId, 'mines')
    if (!round) throw new PlayError('Нет открытого раунда', 409)

    const sec = round.secret as unknown as MinesSecret
    const opened: number[] = (round.progress as { opened: number[] }).opened
    if (opened.includes(b.cell)) throw new PlayError('Клетка уже открыта')

    if (sec.bombs.includes(b.cell)) {
      const done = await finish(userId, round, {
        win: false, payout: 0, value: 0,
        detail: { cell: b.cell, opened: opened.length, bombs: sec.bombs },
      })
      return { ...done, bomb: true, bombs: sec.bombs, opened }
    }

    const next = [...opened, b.cell]
    const safeLeft = MINES_SIZE - sec.mines - next.length
    if (safeLeft === 0) {
      // поле пройдено целиком — забираем автоматически
      return cashoutMines(userId, round, sec, next, true)
    }
    await db.liveRound.update({ where: { id: round.id }, data: { progress: { opened: next } } })
    return {
      bomb: false,
      opened: next,
      mult: minesMult(sec.mines, next.length),
      nextMult: minesMult(sec.mines, next.length + 1),
      cashout: Math.round(n(round.bet) * minesMult(sec.mines, next.length)),
    }
  })

  route('/play/mines/cashout', z.object({}), async (userId) => {
    const round = await findLive(userId, 'mines')
    if (!round) throw new PlayError('Нет открытого раунда', 409)
    const sec = round.secret as unknown as MinesSecret
    const opened: number[] = (round.progress as { opened: number[] }).opened
    if (!opened.length) throw new PlayError('Сначала открой хотя бы одну клетку')
    return cashoutMines(userId, round, sec, opened, false)
  })

  async function cashoutMines(
    userId: string,
    round: { id: string; game: string; bet: bigint; seedId: string; nonce: number },
    sec: MinesSecret,
    opened: number[],
    cleared: boolean,
  ) {
    const mult = minesMult(sec.mines, opened.length)
    const payout = Math.round(n(round.bet) * mult)
    const done = await finish(
      userId, round,
      { win: true, payout, value: payout, mult, detail: { opened: opened.length, mines: sec.mines } },
      { minesCashouts: 1 },
    )
    return { ...done, bomb: false, cleared, bombs: sec.bombs, opened, mult, payout }
  }

  // ——————————————————————————————— башня

  route('/play/tower/start', z.object({
    bet: z.number().int().min(1).max(1e12),
    bombs: z.number().int().min(1).max(2),
  }), (userId, b) =>
    begin(userId, 'tower', b.bet, (rng) => ({
      secret: { bombs: b.bombs, rows: towerRows(rng, b.bombs) } satisfies TowerSecret,
      progress: { picked: [] as number[] },
    })),
  )

  route('/play/tower/pick', z.object({ col: z.number().int().min(0).max(2) }), async (userId, b) => {
    const round = await findLive(userId, 'tower')
    if (!round) throw new PlayError('Нет открытого раунда', 409)

    const sec = round.secret as unknown as TowerSecret
    const picked: number[] = (round.progress as { picked: number[] }).picked
    const floor = picked.length
    if (floor >= TOWER_FLOORS) throw new PlayError('Башня уже пройдена')

    if (!sec.rows[floor].includes(b.col)) {
      const done = await finish(userId, round, {
        win: false, payout: 0, value: 0,
        detail: { floor, col: b.col, rows: sec.rows },
      })
      return { ...done, dead: true, rows: sec.rows, picked: [...picked, b.col] }
    }

    const next = [...picked, b.col]
    if (next.length === TOWER_FLOORS) return cashoutTower(userId, round, sec, next, true)

    await db.liveRound.update({ where: { id: round.id }, data: { progress: { picked: next } } })
    return {
      dead: false,
      picked: next,
      safe: sec.rows[floor],
      mult: towerMult(sec.bombs, next.length),
      nextMult: towerMult(sec.bombs, next.length + 1),
      cashout: Math.round(n(round.bet) * towerMult(sec.bombs, next.length)),
    }
  })

  route('/play/tower/cashout', z.object({}), async (userId) => {
    const round = await findLive(userId, 'tower')
    if (!round) throw new PlayError('Нет открытого раунда', 409)
    const sec = round.secret as unknown as TowerSecret
    const picked: number[] = (round.progress as { picked: number[] }).picked
    if (!picked.length) throw new PlayError('Сначала пройди хотя бы один этаж')
    return cashoutTower(userId, round, sec, picked, false)
  })

  async function cashoutTower(
    userId: string,
    round: { id: string; game: string; bet: bigint; seedId: string; nonce: number },
    sec: TowerSecret,
    picked: number[],
    cleared: boolean,
  ) {
    const mult = towerMult(sec.bombs, picked.length)
    const payout = Math.round(n(round.bet) * mult)
    const done = await finish(
      userId, round,
      { win: true, payout, value: payout, mult, detail: { floors: picked.length, bombs: sec.bombs } },
      { towerCashouts: 1, towerBestFloor: picked.length },
    )
    return { ...done, dead: false, cleared, rows: sec.rows, picked, mult, payout }
  }

  // ——————————————————————————————— краш

  route('/play/crash/start', z.object({
    bet: z.number().int().min(1).max(1e12),
    autoAt: z.number().min(1.01).max(1e6).optional(),
  }), async (userId, b) => {
    await settleExpiredCrash(userId)
    return begin(userId, 'crash', b.bet, (rng) => ({
      secret: { point: crashPoint(rng.roll()), autoAt: b.autoAt } satisfies CrashSecret,
      progress: {},
    }))
  })

  route('/play/crash/cashout', z.object({ at: z.number().min(1).max(1e6) }), async (userId, b) => {
    const round = await findLive(userId, 'crash')
    if (!round) throw new PlayError('Нет открытого раунда', 409)

    const sec = round.secret as unknown as CrashSecret
    const elapsed = (Date.now() - round.startedAt.getTime() + CRASH_GRACE_MS) / 1000
    const reachable = crashMultAt(elapsed)
    const at = Math.floor(b.at * 100) / 100

    if (at > reachable) throw new PlayError('Множитель ещё не набран')
    if (at >= sec.point) {
      const done = await finish(userId, round, {
        win: false, payout: 0, value: 0,
        detail: { point: sec.point, asked: at },
      })
      return { ...done, crashed: true, point: sec.point }
    }

    const payout = Math.round(n(round.bet) * at)
    const done = await finish(
      userId, round,
      { win: true, payout, value: payout, mult: at, detail: { point: sec.point, at } },
      { crashCashouts: 1, bestCrash: at },
    )
    return { ...done, crashed: false, point: sec.point, mult: at, payout }
  })

  // ——————————————————————————————— общее состояние

  app.get('/play/state', async (req, reply) => {
    const auth = readAuth(req, secret)
    if (!auth) return reply.code(401).send({ error: 'Нужен вход' })
    await settleExpiredCrash(auth.userId)

    const rows = await db.liveRound.findMany({
      where: { userId: auth.userId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    })
    // наружу уходит только то, что игрок и так видит на экране
    return {
      rounds: rows.map((r) => {
        const base = { game: r.game, bet: n(r.bet), startedAt: r.startedAt.getTime() }
        if (r.game === 'mines') {
          const sec = r.secret as unknown as MinesSecret
          const opened = (r.progress as { opened: number[] }).opened
          return { ...base, mines: sec.mines, opened, mult: minesMult(sec.mines, opened.length) }
        }
        if (r.game === 'tower') {
          const sec = r.secret as unknown as TowerSecret
          const picked = (r.progress as { picked: number[] }).picked
          return { ...base, bombs: sec.bombs, picked, mult: towerMult(sec.bombs, picked.length) }
        }
        const sec = r.secret as unknown as CrashSecret
        return { ...base, autoAt: sec.autoAt }
      }),
    }
  })
}
