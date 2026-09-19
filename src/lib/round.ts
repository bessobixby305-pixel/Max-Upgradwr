/** Мост между экранами игр и расчётом раунда.
 *
 *  Вошёл в аккаунт — раунд считает сервер, устройство только рисует
 *  результат. Не вошёл — та же математика крутится локально из общего
 *  ядра, поэтому офлайн-режим ведёт себя один в один. */

import { Outcome, Rng, rngFor } from '../core/games'
import { ITEM_BY_ID } from '../core/items'
import { ResultKind, Stats, useGame } from '../store/game'
import { useAccount } from '../store/account'
import { ApiError, apiConfigured, call } from './api'

export interface RoundResult {
  outcome: Outcome
  /** предмет, выданный сервером; офлайн — созданный локально */
  item?: { uid: string; id: string; price: number }
  unlocked: { id: string; name: string; emo: string; reward: number }[]
  online: boolean
}

export const onlineMode = () => apiConfigured() && !!useAccount.getState().access

/** Бросок из локальной цепочки честности. */
export function localRng(): Rng {
  const g = useGame.getState()
  const { nonce } = g.nextRoll()
  return rngFor(g.fair.serverSeed, g.fair.clientSeed, nonce)
}

/** Приращения статистики, которые сервер считает сам, а офлайн — мы. */
export type Bump = Partial<Stats>

interface InstantSpec {
  kind: ResultKind
  /** ставка деньгами; 0 — если игра платит предметами или бесплатна */
  bet: number
  /** путь и тело запроса к серверу */
  path: string
  body: Record<string, unknown>
  /** та же игра локально */
  local: (rng: Rng) => Outcome
  /** дополнительная статистика; получает исход */
  bump?: (o: Outcome) => Bump
}

/** Сыграть мгновенный раунд. Бросает Error с текстом для тоста. */
export async function playInstant(spec: InstantSpec): Promise<RoundResult> {
  return onlineMode() ? playOnServer(spec) : playLocally(spec)
}

async function playOnServer(spec: InstantSpec): Promise<RoundResult> {
  const acc = useAccount.getState()
  const res = await acc.withToken((token) =>
    call<{
      balance: number; xp: number; outcome: Outcome
      item?: { uid: string; id: string; price: number }
      unlocked: RoundResult['unlocked']
      fair: { serverSeedHash: string; clientSeed: string; nonce: number }
    }>(spec.path, { body: spec.body, token }),
  ).catch((e) => {
    throw new Error(e instanceof ApiError ? e.message : 'Сервер не ответил')
  })

  applyServerRound(res)
  return { outcome: res.outcome, item: res.item, unlocked: res.unlocked, online: true }
}

function playLocally(spec: InstantSpec): RoundResult {
  const g = useGame.getState()
  if (spec.bet > 0 && !g.bet(spec.bet)) throw new Error('Недостаточно MX')

  const outcome = spec.local(localRng())

  let item: RoundResult['item']
  if (outcome.itemId) {
    const row = g.addItem(outcome.itemId)
    g.recordWin(outcome.value)
    item = { uid: row.uid, id: outcome.itemId, price: ITEM_BY_ID[outcome.itemId]?.price ?? 0 }
  } else if (outcome.payout > 0) {
    g.win(outcome.payout)
  }

  const s = useGame.getState().stats
  g.bumpStats({
    spins: s.spins + 1,
    wins: s.wins + (outcome.win ? 1 : 0),
    losses: s.losses + (outcome.win ? 0 : 1),
    bestMult: Math.max(s.bestMult, outcome.mult ?? 0),
    ...(spec.bump?.(outcome) ?? {}),
  })
  g.logRound({
    kind: spec.kind,
    roll: Number(outcome.detail.roll ?? 0),
    chance: outcome.chance,
    win: outcome.win,
    payout: outcome.payout + (item?.price ?? 0),
  })
  g.checkAchievements()

  return { outcome, item, unlocked: [], online: false }
}

/** Разложить ответ сервера по локальному состоянию. */
export function applyServerRound(res: {
  balance: number
  xp: number
  item?: { uid: string; id: string; price: number }
  unlocked?: RoundResult['unlocked']
  fair?: { serverSeedHash: string; clientSeed: string; nonce: number }
}) {
  const g = useGame.getState()
  g.setServerState({ balance: res.balance, xp: res.xp, nonce: res.fair?.nonce })
  if (res.item) g.putItem(res.item)
  for (const a of res.unlocked ?? []) {
    g.toast(`${a.emo} ${a.name} · +${a.reward} MX`)
  }
}

/** Продать предметы: онлайн — на сервере, офлайн — локально. */
export async function sellItems(uids: string[]) {
  const g = useGame.getState()
  if (!onlineMode()) {
    for (const u of uids) g.sellItem(u)
    return
  }
  const r = await serverCall<{ sold: number; gain: number; balance: number }>('/inventory/sell', { uids })
  g.setServerState({ balance: r.balance, xp: g.xp })
  g.removeItems(uids)
  g.toast(`Продано: ${r.sold} · +${r.gain} MX`)
}

/** Активировать промокод. */
export async function redeemCode(code: string): Promise<{ ok: boolean; msg: string }> {
  const g = useGame.getState()
  if (!onlineMode()) return g.redeemPromo(code)
  try {
    const r = await serverCall<{
      label: string; amount: number; balance: number
      items: { uid: string; id: string; price: number }[]
    }>('/promo', { code: code.trim().toUpperCase() })
    g.setServerState({ balance: r.balance, xp: g.xp })
    for (const it of r.items) g.putItem(it)
    return {
      ok: true,
      msg: r.amount ? `${r.label}: +${r.amount} MX` : `${r.label}: предметы в инвентаре`,
    }
  } catch (e) {
    return { ok: false, msg: (e as Error).message }
  }
}

/** Запрос к серверу вне схемы «одна ставка — один раунд»: мины, башня, краш. */
export async function serverCall<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const acc = useAccount.getState()
  return acc.withToken((token) => call<T>(path, { body, token })).catch((e) => {
    throw new Error(e instanceof ApiError ? e.message : 'Сервер не ответил')
  })
}

/** Чтение состояния: списки битв, комната джекпота, незакрытые раунды. */
export async function serverGet<T>(path: string): Promise<T> {
  const acc = useAccount.getState()
  return acc.withToken((token) => call<T>(path, { method: 'GET', token })).catch((e) => {
    throw new Error(e instanceof ApiError ? e.message : 'Сервер не ответил')
  })
}
