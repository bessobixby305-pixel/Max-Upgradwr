/** Мгновенные игры: один запрос — один раунд. */

import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { db, n } from './db.js'
import { readAuth } from './profile.js'
import { PlayError, playRound } from './settle.js'
import { GameError } from './core/games.js'
import {
  DICE_MAX_T, DICE_MIN_T, DoubleColor, caseById,
  playCase, playContract, playDice, playDouble, playSlots, playUpgrade, playWheel,
} from './core/games.js'
import { ITEM_BY_ID } from './core/items.js'
import {
  DAILY_COOLDOWN, DAILY_RESET, RESCUE_AMOUNT, RESCUE_COOLDOWN, RESCUE_THRESHOLD,
  SELL_RATE, WHEEL_COOLDOWN, dailyReward,
} from './core/economy.js'

const bet = z.number().int().min(1).max(1e12)

export function fail(reply: FastifyReply, e: unknown) {
  if (e instanceof PlayError) return reply.code(e.status).send({ error: e.message })
  // ошибка в параметрах ставки — это запрос игрока, а не поломка сервера
  if (e instanceof GameError) return reply.code(400).send({ error: e.message })
  throw e
}

/** Забрать бонус с кулдауном. Проверка и отметка времени — одним UPDATE,
 *  поэтому два одновременных запроса не выдадут бонус дважды. */
async function claimCooldown(
  userId: string,
  field: 'wheelAt' | 'dailyAt' | 'rescueAt',
  cooldown: number,
  label: string,
) {
  const cutoff = new Date(Date.now() - cooldown)
  const hit = await db.profile.updateMany({
    where: { userId, OR: [{ [field]: null }, { [field]: { lt: cutoff } }] },
    data: { [field]: new Date() },
  })
  if (hit.count !== 1) {
    const profile = await db.profile.findUnique({ where: { userId } })
    const at = profile?.[field]?.getTime() ?? 0
    const left = Math.max(0, cooldown - (Date.now() - at))
    const mins = Math.ceil(left / 60000)
    throw new PlayError(
      mins >= 60
        ? `${label}: ещё ${Math.floor(mins / 60)} ч ${mins % 60} мин`
        : `${label}: ещё ${mins} мин`,
    )
  }
}

export function playRoutes(app: FastifyInstance, secret: string) {
  /** Общая обвязка: проверка входа, разбор тела, понятная ошибка. */
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
        return fail(reply, e)
      }
    })
  }

  // ——— апгрейд
  route(
    '/play/upgrade',
    z.object({ bet, mult: z.number().min(1).max(60).optional(), targetId: z.string().max(64).optional() })
      .refine((v) => v.mult !== undefined || v.targetId !== undefined, 'Нужен множитель или цель'),
    (userId, b) =>
      playRound({
        userId, game: 'upgrade', bet: b.bet,
        run: (rng) => playUpgrade(rng, { bet: b.bet, mult: b.mult, targetId: b.targetId }),
      }),
  )

  // ——— кейсы
  route('/play/case', z.object({ caseId: z.string().max(64) }), (userId, b) => {
    const c = caseById(b.caseId)
    return playRound({
      userId, game: 'case', bet: c.price, source: `case:${c.id}`,
      bump: { casesOpened: 1 },
      run: (rng) => playCase(rng, c),
    })
  })

  // ——— кости
  route(
    '/play/dice',
    z.object({ bet, target: z.number().int().min(DICE_MIN_T).max(DICE_MAX_T), over: z.boolean() }),
    (userId, b) =>
      playRound({
        userId, game: 'dice', bet: b.bet,
        run: (rng) => playDice(rng, b),
        bumpFor: (o) => (o.win ? { diceWins: 1 } : {}),
      }),
  )

  // ——— дабл
  route(
    '/play/double',
    z.object({ bet, pick: z.enum(['red', 'black', 'green']) }),
    (userId, b) =>
      playRound({
        userId, game: 'double', bet: b.bet,
        run: (rng) => playDouble(rng, { bet: b.bet, pick: b.pick as DoubleColor }),
        bumpFor: (o) => (o.win && o.detail.color === 'green' ? { doubleGreens: 1 } : {}),
      }),
  )

  // ——— слоты
  route('/play/slots', z.object({ bet }), (userId, b) =>
    playRound({
      userId, game: 'slots', bet: b.bet,
      bump: { slotSpins: 1 },
      run: (rng) => playSlots(rng, b),
      bumpFor: (o) => (o.detail.kind === 'jackpot' ? { slotJackpots: 1 } : {}),
    }),
  )

  // ——— контракт: ставка — сами предметы, они сгорают
  route('/play/contract', z.object({ uids: z.array(z.string().max(40)).min(3).max(10) }), async (userId, b) => {
    const uids = [...new Set(b.uids)]
    const items = await db.item.findMany({ where: { id: { in: uids }, userId } })
    if (items.length !== uids.length) throw new PlayError('Часть предметов не найдена')

    const prices = items.map((i) => i.price)
    const sum = prices.reduce((s, x) => s + x, 0)

    // предметы списываются до броска: повторный запрос с теми же uid не пройдёт
    const burned = await db.item.deleteMany({ where: { id: { in: uids }, userId } })
    if (burned.count !== uids.length) throw new PlayError('Предметы уже использованы')

    let played
    try {
      played = await playRound({
        userId, game: 'contract', bet: 0, source: 'contract',
        bump: { contracts: 1 },
        run: (rng) => playContract(rng, prices),
      })
    } catch (e) {
      // раунд не состоялся — возвращаем предметы владельцу
      await db.item.createMany({
        data: items.map((i) => ({ userId, itemId: i.itemId, price: i.price, source: i.source })),
      })
      throw e
    }
    // прокрут по контракту считается по сумме сожжённого
    await db.profile.update({ where: { userId }, data: { totalWagered: { increment: BigInt(sum) } } })
    return played
  })

  // ——— колесо дня
  route('/play/wheel', z.object({}), async (userId) => {
    await claimCooldown(userId, 'wheelAt', WHEEL_COOLDOWN, 'Колесо')
    return playRound({ userId, game: 'wheel', bet: 0, run: (rng) => playWheel(rng) })
  })

  // ——— ежедневный бонус
  route('/bonus/daily', z.object({}), async (userId) => {
    const now = Date.now()
    const before = await db.profile.findUniqueOrThrow({ where: { userId } })
    await claimCooldown(userId, 'dailyAt', DAILY_COOLDOWN, 'Ежедневный бонус')

    const since = before.dailyAt ? now - before.dailyAt.getTime() : Infinity
    const streak = since <= DAILY_RESET ? before.dailyStreak + 1 : 1
    const amount = dailyReward(streak)

    const profile = await db.profile.update({
      where: { userId },
      data: { dailyStreak: streak, balance: { increment: BigInt(amount) } },
    })
    if (profile.balance > profile.maxBalance) {
      await db.profile.update({ where: { userId }, data: { maxBalance: profile.balance } })
    }
    return { amount, streak, balance: n(profile.balance) }
  })

  // ——— страховка при почти нулевом балансе
  route('/bonus/rescue', z.object({}), async (userId) => {
    const before = await db.profile.findUniqueOrThrow({ where: { userId } })
    if (n(before.balance) > RESCUE_THRESHOLD) {
      throw new PlayError(`Страховка доступна при балансе не выше ${RESCUE_THRESHOLD} MX`)
    }
    await claimCooldown(userId, 'rescueAt', RESCUE_COOLDOWN, 'Страховка')
    const profile = await db.profile.update({
      where: { userId },
      data: { balance: { increment: BigInt(RESCUE_AMOUNT) } },
    })
    return { amount: RESCUE_AMOUNT, balance: n(profile.balance) }
  })

  // ——— продажа предметов
  app.post('/inventory/sell', async (req, reply) => {
    const auth = readAuth(req, secret)
    if (!auth) return reply.code(401).send({ error: 'Нужен вход' })
    const body = z.object({ uids: z.array(z.string().max(40)).min(1).max(500) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Нечего продавать' })

    const uids = [...new Set(body.data.uids)]
    const result = await db.$transaction(async (tx) => {
      const items = await tx.item.findMany({ where: { id: { in: uids }, userId: auth.userId } })
      if (!items.length) throw new PlayError('Предметы не найдены')
      const gain = items.reduce((s, i) => s + Math.round((ITEM_BY_ID[i.itemId]?.price ?? i.price) * SELL_RATE), 0)

      const gone = await tx.item.deleteMany({ where: { id: { in: items.map((i) => i.id) }, userId: auth.userId } })
      if (gone.count !== items.length) throw new PlayError('Предметы уже проданы')

      const profile = await tx.profile.update({
        where: { userId: auth.userId },
        data: { balance: { increment: BigInt(gain) } },
      })
      if (profile.balance > profile.maxBalance) {
        await tx.profile.update({ where: { userId: auth.userId }, data: { maxBalance: profile.balance } })
      }
      return { sold: items.length, gain, balance: n(profile.balance) }
    })
    return result
  })
}
