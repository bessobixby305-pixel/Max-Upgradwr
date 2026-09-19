import './fasthmac.js'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { db } from './db.js'
import { authRoutes } from './auth.js'
import { profileRoutes } from './profile.js'
import { playRoutes } from './play.js'
import { liveRoutes } from './live.js'
import { versusRoutes } from './versus.js'
import { adminRoutes } from './admin.js'

const SECRET = process.env.JWT_SECRET
if (!SECRET || SECRET.length < 16) {
  console.error('JWT_SECRET не задан или слишком короткий')
  process.exit(1)
}

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  trustProxy: true,
})

await app.register(cors, { origin: true, credentials: true })
await app.register(rateLimit, {
  // игра шлёт по запросу на раунд, автоспин даёт всплески
  max: 600,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
})

app.get('/health', async () => {
  await db.$queryRaw`select 1`
  return { ok: true, at: new Date().toISOString() }
})

authRoutes(app, SECRET)
profileRoutes(app, SECRET)
playRoutes(app, SECRET)
liveRoutes(app, SECRET)
versusRoutes(app, SECRET)
adminRoutes(app, SECRET)

const port = Number(process.env.PORT ?? 3000)
await app.listen({ port, host: '0.0.0.0' })
