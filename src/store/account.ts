import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ApiError, ServerProfile, Tokens, api, apiConfigured } from '../lib/api'
import { ITEM_BY_ID } from '../core/items'
import { useGame } from './game'

export interface AccountState {
  access: string | null
  refresh: string | null
  login: string | null
  role: 'PLAYER' | 'ADMIN' | null
  me: ServerProfile | null
  busy: boolean
  /** последняя проверка связи: null — не проверяли */
  online: boolean | null

  signUp: (login: string, password: string) => Promise<string | null>
  signIn: (login: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  /** Выполнить запрос с авто-обновлением протухшего access-токена. */
  withToken: <T>(fn: (token: string) => Promise<T>) => Promise<T>
  loadMe: () => Promise<string | null>
  uploadLocalSave: () => Promise<string | null>
  ping: () => Promise<boolean>
}

const EMPTY = { access: null, refresh: null, login: null, role: null, me: null } as const

export const useAccount = create<AccountState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      busy: false,
      online: null,

      signUp: async (login, password) => {
        set({ busy: true })
        try {
          const t: Tokens = await api.register(login, password)
          set({ access: t.access, refresh: t.refresh, login: login.toLowerCase() })
          await get().loadMe()
          return null
        } catch (e) {
          return (e as ApiError).message
        } finally {
          set({ busy: false })
        }
      },

      signIn: async (login, password) => {
        set({ busy: true })
        try {
          const t: Tokens = await api.login(login, password)
          set({ access: t.access, refresh: t.refresh, login: login.toLowerCase() })
          await get().loadMe()
          return null
        } catch (e) {
          return (e as ApiError).message
        } finally {
          set({ busy: false })
        }
      },

      signOut: async () => {
        const { refresh } = get()
        if (refresh) {
          // не смогли погасить сессию на сервере — она всё равно протухнет сама
          try { await api.logout(refresh) } catch { /* офлайн */ }
        }
        set({ ...EMPTY })
      },

      withToken: async (fn) => {
        const { access, refresh } = get()
        if (!access) throw new ApiError('Нужен вход', 401)
        try {
          return await fn(access)
        } catch (e) {
          if ((e as ApiError).status !== 401 || !refresh) throw e
          // access живёт 15 минут — меняем пару и повторяем один раз
          const t = await api.refresh(refresh)
          set({ access: t.access, refresh: t.refresh })
          return fn(t.access)
        }
      },

      loadMe: async () => {
        if (!get().access) return 'Нужен вход'
        try {
          const me = await get().withToken((t) => api.me(t))
          set({ me, role: me.role, login: me.login, online: true })
          return null
        } catch (e) {
          const err = e as ApiError
          // сессия умерла окончательно — выходим, чтобы не показывать чужой профиль
          if (err.status === 401 || err.status === 403) set({ ...EMPTY })
          if (err.status === 0) set({ online: false })
          return err.message
        }
      },

      uploadLocalSave: async () => {
        const g = useGame.getState()
        const inventory = g.inventory
          .map((i) => ({ id: i.id, price: ITEM_BY_ID[i.id]?.price ?? 0 }))
          .slice(0, 1000)
        set({ busy: true })
        try {
          const me = await get().withToken((t) =>
            api.importSave(t, {
              balance: Math.max(0, Math.round(g.balance)),
              xp: Math.max(0, Math.round(g.xp)),
              inventory,
            }),
          )
          set({ me })
          return null
        } catch (e) {
          return (e as ApiError).message
        } finally {
          set({ busy: false })
        }
      },

      ping: async () => {
        if (!apiConfigured()) { set({ online: false }); return false }
        try {
          await api.health()
          set({ online: true })
          return true
        } catch {
          set({ online: false })
          return false
        }
      },
    }),
    {
      name: 'max-upgrader-account',
      version: 1,
      partialize: (s) => ({
        access: s.access, refresh: s.refresh, login: s.login, role: s.role,
      }),
    },
  ),
)
