import { createHash, randomBytes } from 'node:crypto'
import { db } from './db.js'

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/** Активная цепочка сидов игрока. Нет — заводим новую. */
export async function activeSeed(userId: string, clientSeed?: string) {
  const found = await db.seed.findFirst({ where: { userId, active: true } })
  if (found) return found
  const serverSeed = randomBytes(32).toString('hex')
  return db.seed.create({
    data: {
      userId,
      serverSeed,
      serverSeedHash: sha256(serverSeed),
      clientSeed: clientSeed ?? randomBytes(8).toString('hex'),
    },
  })
}

/** Смена цепочки: старая раскрывается, заводится новая. */
export async function rotateSeed(userId: string, clientSeed?: string) {
  await db.seed.updateMany({
    where: { userId, active: true },
    data: { active: false, revealedAt: new Date() },
  })
  return activeSeed(userId, clientSeed)
}
