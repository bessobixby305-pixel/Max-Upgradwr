/** Игра между игроками: битвы кейсов и джекпот.
 *
 *  Боты нужны, чтобы не ждать вечно, и на отдачу они не влияют.
 *  В битве шанс победы у каждого места ровно 1/N — все тянут из одного
 *  распределения, поэтому ожидание игрока равно его ставке на RTP кейса
 *  при любом числе мест. В джекпоте победитель выбирается пропорционально
 *  ставке, и честность обеспечивает комиссия: сколько бы ни поставили
 *  боты, ожидание игрока равно его ставке за вычетом комиссии. */

import type { FastifyInstance } from 'fastify'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db, n } from './db.js'
import { readAuth } from './profile.js'
import { PlayError, grantAchievements, takeBet } from './settle.js'
import { GameError, caseById, rngFor } from './core/games.js'
import { pickDrop } from './core/cases.js'
import { ITEM_BY_ID } from './core/items.js'
import { levelFromXp, xpForBet } from './core/economy.js'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

const BOT_NAMES = [
  'Артём_max', 'Ника228', 'Тимур_pro', 'Соня🍀', 'Денис_off', 'Влад ЪУЪ',
  'Катя_чат', 'Гоша2010', 'Лера_ok', 'Миша_ъ', 'Рита🌸', 'Стас_night',
]
const BOT_EMOS = ['🐱', '🐼', '🦊', '🐸', '👾', '🎧', '🐝', '🍕', '🦖', '🐙']

/** Комиссия джекпота. Без неё добивание ботами делало бы отдачу больше 100%. */
export const JACKPOT_RAKE = 0.08
/** Сколько комната ждёт живых игроков, прежде чем добить ботами.
 *  В тестах укорачивается переменной окружения. */
const JACKPOT_WAIT_MS = Number(process.env.JACKPOT_WAIT_MS ?? 25_000)
const JACKPOT_MIN_BET = 10

function bots(count: number, taken: string[]) {
  const free = BOT_NAMES.filter((x) => !taken.includes(x))
  const out: { name: string; emo: string }[] = []
  for (let i = 0; i < count; i++) {
    const name = free.splice(Math.floor(Math.random() * free.length), 1)[0] ?? `Гость${i}`
    out.push({ name, emo: BOT_EMOS[Math.floor(Math.random() * BOT_EMOS.length)] })
  }
  return out
}

// ═══════════════════════════════════════════════════════ битвы

const battleView = (b: any, meId?: string) => ({
  id: b.id,
  caseId: b.caseId,
  rounds: b.rounds,
  seats: b.seats,
  bet: n(b.bet),
  status: b.status,
  createdAt: b.createdAt.getTime(),
  winnerSeat: b.winnerSeat,
  mySeat: b.players?.find((p: any) => p.userId && p.userId === meId)?.seat ?? null,
  // сид раскрываем только после боя — до него виден лишь хэш
  fair: {
    serverSeedHash: b.serverSeedHash,
    serverSeed: b.status === 'done' ? b.serverSeed : null,
  },
  players: (b.players ?? []).map((p: any) => ({
    seat: p.seat,
    name: p.name,
    emo: p.emo,
    bot: !p.userId,
    me: !!meId && p.userId === meId,
    drops: p.drops,
    total: n(p.total),
  })),
})

/** Разыграть битву целиком и раздать банк победителю. */
async function resolveBattle(battleId: string) {
  const battle = await db.battle.findUnique({ where: { id: battleId }, include: { players: true } })
  if (!battle || battle.status !== 'open') return battle
  if (battle.players.length < battle.seats) return battle

  const box = caseById(battle.caseId)
  const seats = [...battle.players].sort((a, b) => a.seat - b.seat)

  // раунды разыгрываются из сида битвы: курсор = место * 100 + раунд
  const rng = rngFor(battle.serverSeed, battle.id, 1)
  const results = seats.map((p) => {
    const drops: string[] = []
    let total = 0
    for (let r = 0; r < battle.rounds; r++) {
      const item = pickDrop(box, rng.roll(p.seat * 100 + r))
      drops.push(item.id)
      total += item.price
    }
    return { player: p, drops, total }
  })

  let best = results[0]
  for (const r of results) if (r.total > best.total) best = r
  // при равных суммах решает отдельный бросок, а не порядок мест
  const tied = results.filter((r) => r.total === best.total)
  if (tied.length > 1) best = tied[Math.floor(rng.roll(9999) * tied.length)]

  const pot = results.reduce((s, r) => s + r.total, 0)
  const winner = best.player

  await db.$transaction(async (tx) => {
    const closed = await tx.battle.updateMany({
      where: { id: battleId, status: 'open' },
      data: { status: 'done', endedAt: new Date(), winnerSeat: winner.seat },
    })
    // битву уже разыграл параллельный запрос
    if (closed.count !== 1) throw new PlayError('Битва уже сыграна', 409)

    for (const r of results) {
      await tx.battlePlayer.update({
        where: { id: r.player.id },
        data: { drops: r.drops, total: BigInt(r.total) },
      })
    }

    if (winner.userId) {
      // победитель забирает все выпавшие предметы — свои и соперников
      await tx.item.createMany({
        data: results.flatMap((r) =>
          r.drops.map((id) => ({
            userId: winner.userId!,
            itemId: id,
            price: ITEM_BY_ID[id]?.price ?? 0,
            source: `battle:${battleId}`,
          })),
        ),
      })
    }

    for (const r of results) {
      if (!r.player.userId) continue
      const won = r.player.id === winner.id
      const profile = await tx.profile.update({
        where: { userId: r.player.userId },
        data: {
          spins: { increment: 1 },
          casesOpened: { increment: battle.rounds },
          wins: { increment: won ? 1 : 0 },
          losses: { increment: won ? 0 : 1 },
          battlesWon: { increment: won ? 1 : 0 },
          totalWon: { increment: BigInt(won ? pot : 0) },
        },
      })
      if (won && pot > n(profile.biggestWin)) {
        await tx.profile.update({ where: { userId: r.player.userId }, data: { biggestWin: BigInt(pot) } })
      }
      const bestDrop = Math.max(...r.drops.map((id) => ITEM_BY_ID[id]?.price ?? 0), 0)
      if (won && bestDrop > profile.bestItemPrice) {
        await tx.profile.update({ where: { userId: r.player.userId }, data: { bestItemPrice: bestDrop } })
      }
      await tx.round.create({
        data: {
          userId: r.player.userId,
          seedId: (await tx.seed.findFirstOrThrow({ where: { userId: r.player.userId, active: true } })).id,
          game: 'battle',
          bet: battle.bet,
          payout: BigInt(won ? pot : 0),
          roll: 0,
          nonce: 0,
        },
      })
      await grantAchievements(tx, r.player.userId)
    }
  })

  return db.battle.findUnique({ where: { id: battleId }, include: { players: true } })
}

// ═══════════════════════════════════════════════════════ джекпот

const jackpotView = (j: any, meId?: string) => {
  const pot = n(j.pot)
  return {
    id: j.id,
    status: j.status,
    pot,
    rake: JACKPOT_RAKE,
    prize: Math.round(pot * (1 - JACKPOT_RAKE)),
    closesAt: j.closesAt?.getTime() ?? null,
    now: Date.now(),
    winnerId: j.winnerId,
    winnerName: j.winnerName,
    winnerShare: j.winnerShare,
    fair: {
      serverSeedHash: j.serverSeedHash,
      serverSeed: j.status === 'done' ? j.serverSeed : null,
      roll: j.roll,
    },
    entries: (j.entries ?? []).map((e: any) => ({
      id: e.id,
      name: e.name,
      emo: e.emo,
      bot: !e.userId,
      me: !!meId && e.userId === meId,
      bet: n(e.bet),
      share: pot > 0 ? n(e.bet) / pot : 0,
    })),
  }
}

async function openJackpot() {
  const found = await db.jackpot.findFirst({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    include: { entries: { orderBy: { createdAt: 'asc' } } },
  })
  if (found) return found
  const serverSeed = randomBytes(32).toString('hex')
  return db.jackpot.create({
    data: { serverSeed, serverSeedHash: sha256(serverSeed) },
    include: { entries: true },
  })
}

/** Разыграть комнату, если её время вышло. Возвращает свежее состояние. */
async function resolveJackpotIfDue(id: string) {
  const room = await db.jackpot.findUnique({
    where: { id },
    include: { entries: { orderBy: { createdAt: 'asc' } } },
  })
  if (!room || room.status !== 'open') return room
  if (!room.closesAt || room.closesAt.getTime() > Date.now()) return room

  let entries = room.entries
  const humans = entries.filter((e) => e.userId)
  if (!humans.length) {
    // никто не зашёл — комната просто закрывается
    await db.jackpot.update({ where: { id }, data: { status: 'done', endedAt: new Date() } })
    return db.jackpot.findUnique({ where: { id }, include: { entries: true } })
  }

  // добиваем ботами, чтобы банк не был из одного человека
  if (humans.length < 2) {
    const base = n(humans[0].bet)
    const filler = bots(1 + Math.floor(Math.random() * 3), entries.map((e) => e.name))
    const created = await db.$transaction(
      filler.map((b) =>
        db.jackpotEntry.create({
          data: {
            jackpotId: id,
            name: b.name,
            emo: b.emo,
            bet: BigInt(Math.max(JACKPOT_MIN_BET, Math.round(base * (0.3 + Math.random() * 2.2)))),
          },
        }),
      ),
    )
    entries = [...entries, ...created]
  }

  const pot = entries.reduce((s, e) => s + n(e.bet), 0)
  const rng = rngFor(room.serverSeed, room.id, 1)
  const roll = rng.roll()

  let acc = 0
  let winner = entries[entries.length - 1]
  for (const e of entries) {
    acc += n(e.bet) / pot
    if (roll < acc) { winner = e; break }
  }
  const prize = Math.round(pot * (1 - JACKPOT_RAKE))

  await db.$transaction(async (tx) => {
    const closed = await tx.jackpot.updateMany({
      where: { id, status: 'open' },
      data: {
        status: 'done',
        endedAt: new Date(),
        pot: BigInt(pot),
        winnerId: winner.userId,
        winnerName: winner.name,
        winnerShare: n(winner.bet) / pot,
        roll,
      },
    })
    if (closed.count !== 1) return

    for (const e of entries) {
      if (!e.userId) continue
      const won = e.id === winner.id
      const profile = await tx.profile.update({
        where: { userId: e.userId },
        data: {
          spins: { increment: 1 },
          wins: { increment: won ? 1 : 0 },
          losses: { increment: won ? 0 : 1 },
          jackpotWins: { increment: won ? 1 : 0 },
          balance: { increment: BigInt(won ? prize : 0) },
          totalWon: { increment: BigInt(won ? prize : 0) },
        },
      })
      if (profile.balance > profile.maxBalance) {
        await tx.profile.update({ where: { userId: e.userId }, data: { maxBalance: profile.balance } })
      }
      if (won && prize > n(profile.biggestWin)) {
        await tx.profile.update({ where: { userId: e.userId }, data: { biggestWin: BigInt(prize) } })
      }
      await tx.round.create({
        data: {
          userId: e.userId,
          seedId: (await tx.seed.findFirstOrThrow({ where: { userId: e.userId, active: true } })).id,
          game: 'jackpot',
          bet: e.bet,
          payout: BigInt(won ? prize : 0),
          roll,
          chance: n(e.bet) / pot,
          nonce: 0,
        },
      })
      await grantAchievements(tx, e.userId)
    }
  })

  return db.jackpot.findUnique({
    where: { id },
    include: { entries: { orderBy: { createdAt: 'asc' } } },
  })
}

// ═══════════════════════════════════════════════════════ маршруты

export function versusRoutes(app: FastifyInstance, secret: string) {
  const auth = (req: any, reply: any) => {
    const a = readAuth(req, secret)
    if (!a) { reply.code(401).send({ error: 'Нужен вход' }); return null }
    return a
  }
  const guard = async (reply: any, run: () => Promise<unknown>) => {
    try {
      return await run()
    } catch (e) {
      if (e instanceof PlayError) return reply.code(e.status).send({ error: e.message })
      // неизвестный кейс и прочие неверные параметры — это запрос игрока
      if (e instanceof GameError) return reply.code(400).send({ error: e.message })
      throw e
    }
  }

  const profileOf = async (userId: string) => {
    const [user, profile] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: userId } }),
      db.profile.findUniqueOrThrow({ where: { userId } }),
    ])
    return { name: user.login, balance: n(profile.balance), xp: profile.xp }
  }

  // ——————————————————————————————— битвы

  app.get('/battle/list', async (req, reply) => {
    const me = auth(req, reply)
    if (!me) return
    const rows = await db.battle.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { players: true },
    })
    return { battles: rows.map((b) => battleView(b, me.userId)) }
  })

  app.get<{ Params: { id: string } }>('/battle/:id', async (req, reply) => {
    const me = auth(req, reply)
    if (!me) return
    const row = await db.battle.findUnique({
      where: { id: req.params.id },
      include: { players: { orderBy: { seat: 'asc' } } },
    })
    if (!row) return reply.code(404).send({ error: 'Битва не найдена' })
    return battleView(row, me.userId)
  })

  app.post('/battle/create', async (req, reply) => {
    const me = auth(req, reply)
    if (!me) return
    const body = z.object({
      caseId: z.string().max(64),
      rounds: z.number().int().min(1).max(10),
      seats: z.number().int().min(2).max(4),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0].message })

    return guard(reply, async () => {
      const box = caseById(body.data.caseId)
      const cost = box.price * body.data.rounds
      const who = await profileOf(me.userId)
      const serverSeed = randomBytes(32).toString('hex')

      const battle = await db.$transaction(async (tx) => {
        await takeBet(tx, me.userId, cost)
        await tx.profile.update({ where: { userId: me.userId }, data: { xp: { increment: xpForBet(cost) } } })
        return tx.battle.create({
          data: {
            caseId: box.id,
            rounds: body.data.rounds,
            seats: body.data.seats,
            bet: BigInt(cost),
            serverSeed,
            serverSeedHash: sha256(serverSeed),
            createdById: me.userId,
            players: { create: { userId: me.userId, name: who.name, emo: '🦄', seat: 0 } },
          },
          include: { players: true },
        })
      })
      return battleView(battle, me.userId)
    })
  })

  app.post<{ Params: { id: string } }>('/battle/:id/join', async (req, reply) => {
    const me = auth(req, reply)
    if (!me) return
    return guard(reply, async () => {
      const battle = await db.battle.findUnique({
        where: { id: req.params.id },
        include: { players: true },
      })
      if (!battle) throw new PlayError('Битва не найдена', 404)
      if (battle.status !== 'open') throw new PlayError('Битва уже сыграна', 409)
      if (battle.players.some((p) => p.userId === me.userId)) throw new PlayError('Ты уже в этой битве', 409)
      if (battle.players.length >= battle.seats) throw new PlayError('Мест не осталось', 409)

      const who = await profileOf(me.userId)
      const seat = battle.players.length

      await db.$transaction(async (tx) => {
        await takeBet(tx, me.userId, n(battle.bet))
        await tx.profile.update({ where: { userId: me.userId }, data: { xp: { increment: xpForBet(n(battle.bet)) } } })
        // уникальный индекс не даст двум игрокам занять одно место
        await tx.battlePlayer.create({
          data: { battleId: battle.id, userId: me.userId, name: who.name, emo: '🎮', seat },
        })
      })

      const fresh = await db.battle.findUniqueOrThrow({ where: { id: battle.id }, include: { players: true } })
      const done = fresh.players.length >= fresh.seats ? await resolveBattle(battle.id) : fresh
      return battleView(done, me.userId)
    })
  })

  /** Добить свободные места ботами и сыграть сразу. */
  app.post<{ Params: { id: string } }>('/battle/:id/bots', async (req, reply) => {
    const me = auth(req, reply)
    if (!me) return
    return guard(reply, async () => {
      const battle = await db.battle.findUnique({
        where: { id: req.params.id },
        include: { players: true },
      })
      if (!battle) throw new PlayError('Битва не найдена', 404)
      if (battle.status !== 'open') throw new PlayError('Битва уже сыграна', 409)
      if (battle.createdById !== me.userId) throw new PlayError('Добить ботами может только создатель')

      const need = battle.seats - battle.players.length
      if (need > 0) {
        const filler = bots(need, battle.players.map((p) => p.name))
        await db.battlePlayer.createMany({
          data: filler.map((b, i) => ({
            battleId: battle.id,
            name: b.name,
            emo: b.emo,
            seat: battle.players.length + i,
          })),
        })
      }
      const done = await resolveBattle(battle.id)
      return battleView(done, me.userId)
    })
  })

  // ——————————————————————————————— джекпот

  app.get('/jackpot', async (req, reply) => {
    const me = auth(req, reply)
    if (!me) return
    const room = await openJackpot()
    const fresh = await resolveJackpotIfDue(room.id)
    // комната разыграна — сразу показываем следующую и результат прошлой
    const next = fresh?.status === 'done' ? await openJackpot() : fresh
    return {
      room: jackpotView(next, me.userId),
      last: fresh?.status === 'done' ? jackpotView(fresh, me.userId) : null,
    }
  })

  app.post('/jackpot/join', async (req, reply) => {
    const me = auth(req, reply)
    if (!me) return
    const body = z.object({ bet: z.number().int().min(JACKPOT_MIN_BET).max(1e12) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: `Минимальная ставка — ${JACKPOT_MIN_BET} MX` })

    return guard(reply, async () => {
      let room = await openJackpot()
      const due = await resolveJackpotIfDue(room.id)
      if (due?.status === 'done') room = await openJackpot()

      const mine = await db.jackpotEntry.findFirst({ where: { jackpotId: room.id, userId: me.userId } })
      if (mine) throw new PlayError('Ты уже в этом банке', 409)

      const who = await profileOf(me.userId)
      await db.$transaction(async (tx) => {
        await takeBet(tx, me.userId, body.data.bet)
        await tx.profile.update({ where: { userId: me.userId }, data: { xp: { increment: xpForBet(body.data.bet) } } })
        await tx.jackpotEntry.create({
          data: { jackpotId: room.id, userId: me.userId, name: who.name, emo: '🦄', bet: BigInt(body.data.bet) },
        })
        await tx.jackpot.update({
          where: { id: room.id },
          data: {
            pot: { increment: BigInt(body.data.bet) },
            // таймер запускает первый вошедший
            ...(room.closesAt ? {} : { closesAt: new Date(Date.now() + JACKPOT_WAIT_MS) }),
          },
        })
      })

      const fresh = await db.jackpot.findUniqueOrThrow({
        where: { id: room.id },
        include: { entries: { orderBy: { createdAt: 'asc' } } },
      })
      const profile = await db.profile.findUniqueOrThrow({ where: { userId: me.userId } })
      return {
        room: jackpotView(fresh, me.userId),
        balance: n(profile.balance),
        xp: profile.xp,
        level: levelFromXp(profile.xp).lvl,
      }
    })
  })
}
