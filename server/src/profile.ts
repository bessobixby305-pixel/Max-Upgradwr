import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { db, n } from './db.js'
import { verify } from './jwt.js'
import { activeSeed, rotateSeed } from './fair.js'

export interface Auth { userId: string; role: 'PLAYER' | 'ADMIN' }

export function readAuth(req: FastifyRequest, secret: string): Auth | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  const claims = verify(header.slice(7), secret)
  return claims ? { userId: claims.sub, role: claims.role } : null
}

/** Публичный вид профиля: BigInt наружу уходит числом. */
async function shape(userId: string) {
  const [user, profile, items, seed] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.profile.findUnique({ where: { userId } }),
    db.item.findMany({ where: { userId }, orderBy: { acquiredAt: 'desc' }, take: 500 }),
    activeSeed(userId),
  ])
  if (!user || !profile) return null
  return {
    login: user.login,
    role: user.role,
    createdAt: user.createdAt,
    balance: n(profile.balance),
    xp: profile.xp,
    imported: !!profile.importedAt,
    achievements: profile.achievements,
    bonuses: {
      dailyAt: profile.dailyAt?.getTime() ?? 0,
      dailyStreak: profile.dailyStreak,
      wheelAt: profile.wheelAt?.getTime() ?? 0,
      rescueAt: profile.rescueAt?.getTime() ?? 0,
    },
    stats: {
      spins: profile.spins,
      wins: profile.wins,
      losses: profile.losses,
      casesOpened: profile.casesOpened,
      totalWagered: n(profile.totalWagered),
      totalWon: n(profile.totalWon),
      bestMult: profile.bestMult,
      biggestWin: n(profile.biggestWin),
      maxBalance: n(profile.maxBalance),
      bestItemPrice: profile.bestItemPrice,
      minesCashouts: profile.minesCashouts,
      crashCashouts: profile.crashCashouts,
      bestCrash: profile.bestCrash,
      contracts: profile.contracts,
      battlesWon: profile.battlesWon,
      towerCashouts: profile.towerCashouts,
      towerBestFloor: profile.towerBestFloor,
      slotSpins: profile.slotSpins,
      slotJackpots: profile.slotJackpots,
      doubleGreens: profile.doubleGreens,
      diceWins: profile.diceWins,
      jackpotWins: profile.jackpotWins,
    },
    inventory: items.map((i) => ({ uid: i.id, id: i.itemId, at: i.acquiredAt.getTime() })),
    fair: {
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
    },
  }
}

/** Перенос локального сохранения. Разрешён один раз и только пока
 *  на сервере ничего не наиграно — иначе импортом можно было бы
 *  затирать себе проигрыши. */
const importBody = z.object({
  balance: z.number().int().min(0).max(1e15),
  xp: z.number().int().min(0).max(1e9),
  inventory: z.array(z.object({ id: z.string().max(64), price: z.number().int().min(0) })).max(1000),
})

export function profileRoutes(app: FastifyInstance, secret: string) {
  app.get('/me', async (req, reply) => {
    const auth = readAuth(req, secret)
    if (!auth) return reply.code(401).send({ error: 'Нужен вход' })
    const data = await shape(auth.userId)
    if (!data) return reply.code(404).send({ error: 'Профиль не найден' })
    return data
  })

  app.post('/me/import', async (req, reply) => {
    const auth = readAuth(req, secret)
    if (!auth) return reply.code(401).send({ error: 'Нужен вход' })

    const parsed = importBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message })

    const profile = await db.profile.findUnique({ where: { userId: auth.userId } })
    if (!profile) return reply.code(404).send({ error: 'Профиль не найден' })
    if (profile.importedAt) return reply.code(409).send({ error: 'Прогресс уже переносили' })

    const played = await db.round.count({ where: { userId: auth.userId } })
    if (played > 0) return reply.code(409).send({ error: 'На сервере уже есть сыгранные раунды' })

    const { balance, xp, inventory } = parsed.data
    await db.$transaction([
      db.profile.update({
        where: { userId: auth.userId },
        data: {
          balance: BigInt(balance),
          xp,
          maxBalance: BigInt(balance),
          importedAt: new Date(),
        },
      }),
      db.item.createMany({
        data: inventory.map((i) => ({
          userId: auth.userId,
          itemId: i.id,
          price: i.price,
          source: 'import',
        })),
      }),
    ])
    return shape(auth.userId)
  })

  app.post('/me/seed', async (req, reply) => {
    const auth = readAuth(req, secret)
    if (!auth) return reply.code(401).send({ error: 'Нужен вход' })
    const body = z.object({ clientSeed: z.string().trim().min(1).max(64).optional() }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Неверный сид' })

    const old = await db.seed.findFirst({ where: { userId: auth.userId, active: true } })
    const fresh = await rotateSeed(auth.userId, body.data.clientSeed)
    return {
      revealed: old ? { serverSeed: old.serverSeed, hash: old.serverSeedHash, clientSeed: old.clientSeed, rounds: old.nonce } : null,
      fair: { serverSeedHash: fresh.serverSeedHash, clientSeed: fresh.clientSeed, nonce: fresh.nonce },
    }
  })
}
