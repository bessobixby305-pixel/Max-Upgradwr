/** Админка: выдача денег и предметов, промокоды, баны, статистика.
 *
 *  Права даёт разовый код из переменной окружения ADMIN_CODE — он живёт
 *  только на сервере и в репозиторий не попадает. Каждое действие пишется
 *  в журнал: кто, кому и что сделал. */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { timingSafeEqual } from 'node:crypto'
import { db, n } from './db.js'
import { readAuth } from './profile.js'
import { PlayError } from './settle.js'
import { ITEM_BY_ID } from './core/items.js'
import { levelFromXp } from './core/economy.js'

const ADMIN_CODE = process.env.ADMIN_CODE ?? ''

/** Сравнение кода за постоянное время: иначе его можно подобрать по задержке. */
function sameCode(given: string) {
  if (!ADMIN_CODE) return false
  const a = Buffer.from(given)
  const b = Buffer.from(ADMIN_CODE)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function log(adminId: string, action: string, targetUserId: string | null, payload: unknown) {
  await db.adminLog.create({
    data: { adminId, action, targetUserId, payload: payload as object },
  })
}

export function adminRoutes(app: FastifyInstance, secret: string) {
  /** Пускает только администратора. */
  const onlyAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
    const a = readAuth(req, secret)
    if (!a) { reply.code(401).send({ error: 'Нужен вход' }); return null }
    if (a.role !== 'ADMIN') {
      // проверяем и в базе: роль могли выдать уже после выпуска токена
      const user = await db.user.findUnique({ where: { id: a.userId } })
      if (user?.role !== 'ADMIN') { reply.code(403).send({ error: 'Нужны права администратора' }); return null }
    }
    return a
  }

  const guard = async (reply: FastifyReply, run: () => Promise<unknown>) => {
    try {
      return await run()
    } catch (e) {
      if (e instanceof PlayError) return reply.code(e.status).send({ error: e.message })
      throw e
    }
  }

  // ——— получить права по коду
  app.post('/admin/claim', async (req, reply) => {
    const a = readAuth(req, secret)
    if (!a) return reply.code(401).send({ error: 'Нужен вход' })
    const body = z.object({ code: z.string().min(1).max(200) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Нужен код' })
    if (!ADMIN_CODE) return reply.code(400).send({ error: 'Админ-код на сервере не задан' })
    if (!sameCode(body.data.code.trim())) return reply.code(403).send({ error: 'Неверный код' })

    await db.user.update({ where: { id: a.userId }, data: { role: 'ADMIN' } })
    await log(a.userId, 'claim', a.userId, null)
    // токен всё ещё со старой ролью, поэтому клиенту нужен новый вход
    return { ok: true, relogin: true }
  })

  app.get('/admin/me', async (req, reply) => {
    const a = readAuth(req, secret)
    if (!a) return reply.code(401).send({ error: 'Нужен вход' })
    const user = await db.user.findUnique({ where: { id: a.userId } })
    return { admin: user?.role === 'ADMIN', configured: !!ADMIN_CODE }
  })

  // ——— сводка
  app.get('/admin/stats', async (req, reply) => {
    if (!(await onlyAdmin(req, reply))) return
    const dayAgo = new Date(Date.now() - 864e5)

    const [users, banned, activeToday, roundsToday, totals, wagerToday, topRich, lastRounds] =
      await Promise.all([
        db.user.count(),
        db.user.count({ where: { banned: true } }),
        db.user.count({ where: { lastSeenAt: { gte: dayAgo } } }),
        db.round.count({ where: { createdAt: { gte: dayAgo } } }),
        db.profile.aggregate({ _sum: { balance: true, totalWagered: true, totalWon: true } }),
        db.round.aggregate({
          where: { createdAt: { gte: dayAgo } },
          _sum: { bet: true, payout: true },
        }),
        db.profile.findMany({
          orderBy: { balance: 'desc' },
          take: 10,
          include: { user: { select: { login: true, banned: true } } },
        }),
        db.round.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { login: true } } },
        }),
      ])

    const wagered = n(totals._sum.totalWagered ?? 0n)
    const won = n(totals._sum.totalWon ?? 0n)
    const betDay = n(wagerToday._sum.bet ?? 0n)
    const payDay = n(wagerToday._sum.payout ?? 0n)

    return {
      users, banned, activeToday, roundsToday,
      balanceTotal: n(totals._sum.balance ?? 0n),
      wagered, won,
      // фактическая отдача: сколько вернулось игрокам от прокрученного
      rtpAll: wagered > 0 ? won / wagered : null,
      rtpDay: betDay > 0 ? payDay / betDay : null,
      top: topRich.map((p) => ({
        userId: p.userId,
        login: p.user.login,
        banned: p.user.banned,
        balance: n(p.balance),
        level: levelFromXp(p.xp).lvl,
      })),
      recent: lastRounds.map((r) => ({
        id: r.id,
        login: r.user.login,
        game: r.game,
        bet: n(r.bet),
        payout: n(r.payout),
        at: r.createdAt.getTime(),
      })),
    }
  })

  // ——— игроки
  app.get<{ Querystring: { q?: string } }>('/admin/users', async (req, reply) => {
    if (!(await onlyAdmin(req, reply))) return
    const q = (req.query.q ?? '').trim().toLowerCase()
    const rows = await db.user.findMany({
      where: q ? { login: { contains: q } } : undefined,
      orderBy: { lastSeenAt: 'desc' },
      take: 50,
      include: { profile: true, _count: { select: { items: true, rounds: true } } },
    })
    return {
      users: rows.map((u) => ({
        userId: u.id,
        login: u.login,
        role: u.role,
        banned: u.banned,
        banReason: u.banReason,
        createdAt: u.createdAt.getTime(),
        lastSeenAt: u.lastSeenAt.getTime(),
        balance: u.profile ? n(u.profile.balance) : 0,
        level: u.profile ? levelFromXp(u.profile.xp).lvl : 1,
        items: u._count.items,
        rounds: u._count.rounds,
      })),
    }
  })

  app.post<{ Params: { id: string } }>('/admin/users/:id/balance', async (req, reply) => {
    const me = await onlyAdmin(req, reply)
    if (!me) return
    const body = z.object({
      amount: z.number().int().min(-1e12).max(1e12),
      note: z.string().max(200).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Неверная сумма' })

    return guard(reply, async () => {
      const profile = await db.profile.findUnique({ where: { userId: req.params.id } })
      if (!profile) throw new PlayError('Игрок не найден', 404)

      // в минус не уводим: баланс упирается в ноль
      const delta = Math.max(body.data.amount, -n(profile.balance))
      const after = await db.profile.update({
        where: { userId: req.params.id },
        data: { balance: { increment: BigInt(delta) } },
      })
      if (after.balance > after.maxBalance) {
        await db.profile.update({ where: { userId: req.params.id }, data: { maxBalance: after.balance } })
      }
      await log(me.userId, 'balance', req.params.id, { amount: delta, note: body.data.note ?? null })
      return { balance: n(after.balance), applied: delta }
    })
  })

  app.post<{ Params: { id: string } }>('/admin/users/:id/items', async (req, reply) => {
    const me = await onlyAdmin(req, reply)
    if (!me) return
    const body = z.object({ items: z.array(z.string().max(64)).min(1).max(50) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Нужен список предметов' })

    return guard(reply, async () => {
      const known = body.data.items.filter((id) => ITEM_BY_ID[id])
      if (!known.length) throw new PlayError('Таких предметов нет')
      const user = await db.user.findUnique({ where: { id: req.params.id } })
      if (!user) throw new PlayError('Игрок не найден', 404)

      await db.item.createMany({
        data: known.map((id) => ({
          userId: req.params.id,
          itemId: id,
          price: ITEM_BY_ID[id].price,
          source: 'admin',
        })),
      })
      await log(me.userId, 'items', req.params.id, { items: known })
      return { given: known.length }
    })
  })

  app.post<{ Params: { id: string } }>('/admin/users/:id/ban', async (req, reply) => {
    const me = await onlyAdmin(req, reply)
    if (!me) return
    const body = z.object({
      banned: z.boolean(),
      reason: z.string().max(200).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Неверный запрос' })

    return guard(reply, async () => {
      if (req.params.id === me.userId) throw new PlayError('Нельзя забанить самого себя')
      const user = await db.user.findUnique({ where: { id: req.params.id } })
      if (!user) throw new PlayError('Игрок не найден', 404)

      await db.user.update({
        where: { id: req.params.id },
        data: { banned: body.data.banned, banReason: body.data.banned ? body.data.reason ?? null : null },
      })
      // бан выкидывает со всех устройств: гасим живые сессии
      if (body.data.banned) {
        await db.session.updateMany({
          where: { userId: req.params.id, revokedAt: null },
          data: { revokedAt: new Date() },
        })
      }
      await log(me.userId, body.data.banned ? 'ban' : 'unban', req.params.id, { reason: body.data.reason ?? null })
      return { banned: body.data.banned }
    })
  })

  // ——— промокоды
  app.get('/admin/promos', async (req, reply) => {
    if (!(await onlyAdmin(req, reply))) return
    const rows = await db.promo.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return {
      promos: rows.map((p) => ({
        id: p.id,
        code: p.code,
        amount: n(p.amount),
        items: p.items,
        maxUses: p.maxUses,
        usedCount: p.usedCount,
        perUserOnce: p.perUserOnce,
        expiresAt: p.expiresAt?.getTime() ?? null,
        revokedAt: p.revokedAt?.getTime() ?? null,
        note: p.note,
        createdAt: p.createdAt.getTime(),
      })),
    }
  })

  app.post('/admin/promos', async (req, reply) => {
    const me = await onlyAdmin(req, reply)
    if (!me) return
    const body = z.object({
      code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, 'код: латиница, цифры, дефис'),
      amount: z.number().int().min(0).max(1e12).default(0),
      items: z.array(z.string().max(64)).max(50).default([]),
      maxUses: z.number().int().min(1).max(1e6).nullable().optional(),
      perUserOnce: z.boolean().default(true),
      expiresInHours: z.number().int().min(1).max(24 * 365).nullable().optional(),
      note: z.string().max(200).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0].message })

    return guard(reply, async () => {
      const code = body.data.code.toUpperCase()
      if (await db.promo.findUnique({ where: { code } })) throw new PlayError('Такой код уже есть', 409)
      const unknown = body.data.items.filter((id) => !ITEM_BY_ID[id])
      if (unknown.length) throw new PlayError(`Нет предметов: ${unknown.join(', ')}`)
      if (!body.data.amount && !body.data.items.length) throw new PlayError('Код ничего не выдаёт')

      const promo = await db.promo.create({
        data: {
          code,
          amount: BigInt(body.data.amount),
          items: body.data.items,
          maxUses: body.data.maxUses ?? null,
          perUserOnce: body.data.perUserOnce,
          expiresAt: body.data.expiresInHours
            ? new Date(Date.now() + body.data.expiresInHours * 3600_000)
            : null,
          note: body.data.note ?? null,
          createdById: me.userId,
        },
      })
      await log(me.userId, 'promo.create', null, { code, amount: body.data.amount, items: body.data.items })
      return { id: promo.id, code }
    })
  })

  app.post<{ Params: { id: string } }>('/admin/promos/:id/revoke', async (req, reply) => {
    const me = await onlyAdmin(req, reply)
    if (!me) return
    return guard(reply, async () => {
      const promo = await db.promo.findUnique({ where: { id: req.params.id } })
      if (!promo) throw new PlayError('Код не найден', 404)
      await db.promo.update({ where: { id: promo.id }, data: { revokedAt: new Date() } })
      await log(me.userId, 'promo.revoke', null, { code: promo.code })
      return { code: promo.code, revoked: true }
    })
  })

  // ——— журнал
  app.get('/admin/log', async (req, reply) => {
    if (!(await onlyAdmin(req, reply))) return
    const rows = await db.adminLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    const ids = [...new Set(rows.flatMap((r) => [r.adminId, r.targetUserId].filter(Boolean) as string[]))]
    const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, login: true } })
    const name = new Map(users.map((u) => [u.id, u.login]))
    return {
      entries: rows.map((r) => ({
        id: r.id,
        admin: name.get(r.adminId) ?? r.adminId,
        action: r.action,
        target: r.targetUserId ? name.get(r.targetUserId) ?? r.targetUserId : null,
        payload: r.payload,
        at: r.createdAt.getTime(),
      })),
    }
  })
}
