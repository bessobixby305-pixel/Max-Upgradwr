/** Тонкая обёртка над fetch к серверу MAX Upgrader.
 *  Адрес берётся из VITE_API_URL на сборке, но его можно переопределить
 *  в приложении — удобно для отладки и на случай смены домена. */

const BUILD_API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? ''
const OVERRIDE_KEY = 'max-upgrader/api-base'

export function apiBase(): string {
  try {
    const saved = localStorage.getItem(OVERRIDE_KEY)
    if (saved) return saved.replace(/\/+$/, '')
  } catch {
    /* приватный режим — читаем только сборочный адрес */
  }
  return BUILD_API
}

export function setApiBase(url: string) {
  const clean = url.trim().replace(/\/+$/, '')
  try {
    if (clean && clean !== BUILD_API) localStorage.setItem(OVERRIDE_KEY, clean)
    else localStorage.removeItem(OVERRIDE_KEY)
  } catch {
    /* не смогли сохранить — адрес доживёт до перезапуска */
  }
}

export const apiConfigured = () => apiBase().length > 0

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

const TIMEOUT = 12_000

export async function call<T>(
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const base = apiBase()
  if (!base) throw new ApiError('Сервер не настроен', 0)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
  let res: Response
  try {
    res = await fetch(base + path, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: {
        ...(opts.body ? { 'content-type': 'application/json' } : {}),
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    })
  } catch (e) {
    throw new ApiError(
      (e as Error).name === 'AbortError' ? 'Сервер не отвечает' : 'Нет связи с сервером',
      0,
    )
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { /* сервер ответил не JSON */ }

  if (!res.ok) {
    throw new ApiError(data?.error || `Ошибка сервера (${res.status})`, res.status)
  }
  return data as T
}

// ——— типы ответов сервера

export interface Tokens { access: string; refresh: string }

export interface ServerProfile {
  login: string
  role: 'PLAYER' | 'ADMIN'
  createdAt: string
  balance: number
  xp: number
  imported: boolean
  achievements: string[]
  bonuses: { dailyAt: number; dailyStreak: number; wheelAt: number; rescueAt: number }
  stats: {
    spins: number; wins: number; losses: number; casesOpened: number
    totalWagered: number; totalWon: number; bestMult: number
    biggestWin: number; maxBalance: number
    bestItemPrice: number; minesCashouts: number; crashCashouts: number; bestCrash: number
    contracts: number; battlesWon: number; towerCashouts: number; towerBestFloor: number
    slotSpins: number; slotJackpots: number; doubleGreens: number; diceWins: number
    jackpotWins: number
  }
  inventory: { uid: string; id: string; at: number }[]
  fair: { serverSeedHash: string; clientSeed: string; nonce: number }
}

export const api = {
  health: () => call<{ ok: boolean; at: string }>('/health'),
  register: (login: string, password: string) =>
    call<Tokens>('/auth/register', { body: { login, password } }),
  login: (login: string, password: string) =>
    call<Tokens>('/auth/login', { body: { login, password } }),
  refresh: (refresh: string) => call<Tokens>('/auth/refresh', { body: { refresh } }),
  logout: (refresh: string) => call<{ ok: true }>('/auth/logout', { body: { refresh } }),
  me: (token: string) => call<ServerProfile>('/me', { token }),
  importSave: (
    token: string,
    payload: { balance: number; xp: number; inventory: { id: string; price: number }[] },
  ) => call<ServerProfile>('/me/import', { token, body: payload }),
}
