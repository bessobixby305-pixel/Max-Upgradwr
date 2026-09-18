import type { FastifyInstance } from 'fastify'
import argon2 from 'argon2'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from './db.js'
import { issue } from './jwt.js'
import { activeSeed } from './fair.js'

const ACCESS_TTL = 15 * 60
const REFRESH_DAYS = 60

const credentials = z.object({
  login: z.string().trim().min(3).max(24).regex(
    /^[a-zA-Z0-9_]+$/,
    'логин: латиница, цифры и подчёркивание',
  ),
  password: z.string().min(6).max(128),
})

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')

async function openSession(userId: string, role: 'PLAYER' | 'ADMIN', ua: string | undefined, secret: string) {
  const refresh = randomBytes(32).toString('base64url')
  await db.session.create({
    data: {
      userId,
      refreshHash: hashToken(refresh),
      userAgent: ua?.slice(0, 200),
      expiresAt: new Date(Date.now() + REFRESH_DAYS * 864e5),
    },
  })
  return { access: issue({ sub: userId, role }, secret, ACCESS_TTL), refresh }
}

export function authRoutes(app: FastifyInstance, secret: string) {
  app.post('/auth/register', async (req, reply) => {
    const parsed = credentials.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message })
    }
    const { login, password } = parsed.data

    const exists = await db.user.findUnique({ where: { login: login.toLowerCase() } })
    if (exists) return reply.code(409).send({ error: 'Логин занят' })

    const user = await db.user.create({
      data: {
        login: login.toLowerCase(),
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        profile: { create: {} },
      },
    })
    await activeSeed(user.id)

    return openSession(user.id, user.role, req.headers['user-agent'], secret)
  })

  app.post('/auth/login', async (req, reply) => {
    const parsed = credentials.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Неверный логин или пароль' })
    const { login, password } = parsed.data

    const user = await db.user.findUnique({ where: { login: login.toLowerCase() } })
    // одинаковый ответ на «нет такого» и «пароль не тот», чтобы логины не перебирали
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      return reply.code(401).send({ error: 'Неверный логин или пароль' })
    }
    if (user.banned) return reply.code(403).send({ error: user.banReason || 'Аккаунт заблокирован' })

    await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
    return openSession(user.id, user.role, req.headers['user-agent'], secret)
  })

  app.post('/auth/refresh', async (req, reply) => {
    const body = z.object({ refresh: z.string().min(10) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Нет токена' })

    const session = await db.session.findUnique({
      where: { refreshHash: hashToken(body.data.refresh) },
      include: { user: true },
    })
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return reply.code(401).send({ error: 'Сессия истекла' })
    }
    if (session.user.banned) return reply.code(403).send({ error: 'Аккаунт заблокирован' })

    // одноразовый refresh: старый гасим, выдаём новую пару
    await db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
    return openSession(session.userId, session.user.role, req.headers['user-agent'], secret)
  })

  app.post('/auth/logout', async (req, reply) => {
    const body = z.object({ refresh: z.string().min(10) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Нет токена' })
    await db.session.updateMany({
      where: { refreshHash: hashToken(body.data.refresh), revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return { ok: true }
  })
}
