import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { FairState, newFairState, rollFloat } from '../core/fair'
import { ITEM_BY_ID, ItemDef } from '../core/items'
import {
  ACHIEVEMENTS, AchStats, DAILY_COOLDOWN, DAILY_RESET, RESCUE_AMOUNT, RESCUE_COOLDOWN,
  PROMOS, RESCUE_THRESHOLD, SELL_RATE, START_BALANCE, dailyReward, levelFromXp, xpForBet,
} from '../core/economy'

export interface InvItem { uid: string; id: string; at: number }

export type ResultKind = 'upgrade' | 'case' | 'mines' | 'crash' | 'contract' | 'battle' | 'bonus'

export interface GameResult {
  kind: ResultKind
  title: string
  bet: number
  payout: number
  chance?: number
  mult?: number
  itemId?: string
  extra?: string
}

export interface Msg {
  id: string
  chat: 'bot' | 'drops'
  out?: boolean
  text?: string
  result?: GameResult
  ts: number
  author?: { name: string; emo: string }
}

export interface Round {
  n: number
  kind: ResultKind
  roll: number
  chance?: number
  win: boolean
  payout: number
  ts: number
}

export interface Settings {
  theme: 'light' | 'dark' | 'auto'
  sound: boolean
  haptics: boolean
  fastMode: boolean
  showDrops: boolean
}

export interface Stats {
  spins: number
  wins: number
  losses: number
  bestMult: number
  biggestWin: number
  casesOpened: number
  bestItemPrice: number
  maxBalance: number
  minesCashouts: number
  crashCashouts: number
  bestCrash: number
  contracts: number
  battlesWon: number
  totalWagered: number
  totalWon: number
}

const EMPTY_STATS: Stats = {
  spins: 0, wins: 0, losses: 0, bestMult: 0, biggestWin: 0, casesOpened: 0,
  bestItemPrice: 0, maxBalance: START_BALANCE, minesCashouts: 0, crashCashouts: 0,
  bestCrash: 0, contracts: 0, battlesWon: 0, totalWagered: 0, totalWon: 0,
}

export interface GameState {
  balance: number
  xp: number
  inventory: InvItem[]
  fair: FairState
  stats: Stats
  settings: Settings
  messages: Msg[]
  rounds: Round[]
  achievements: string[]
  daily: { last: number; streak: number }
  wheelLast: number
  rescueLast: number
  promos: string[]
  toasts: { id: string; text: string }[]
  createdAt: number

  // ——— деньги
  bet: (amount: number) => boolean
  /** Зачислить выигрыш на баланс. */
  win: (amount: number) => void
  /** Учесть ценность выигрыша в статистике, не трогая баланс
   *  (когда наградой стал предмет, а не деньги). */
  recordWin: (amount: number) => void
  addBalance: (amount: number) => void

  // ——— честность
  nextRoll: (cursor?: number) => { roll: number; nonce: number }
  rotateSeeds: (clientSeed?: string) => void
  setClientSeed: (s: string) => void

  // ——— предметы
  addItem: (id: string) => InvItem
  sellItem: (uid: string) => void
  sellAll: () => void
  removeItems: (uids: string[]) => void

  // ——— записи
  logRound: (r: Omit<Round, 'n' | 'ts'>) => void
  pushResult: (r: GameResult) => void
  pushText: (text: string, out?: boolean) => void
  pushDrop: (m: Omit<Msg, 'id' | 'ts' | 'chat'>) => void
  clearChat: () => void

  // ——— прогресс
  addXp: (n: number) => void
  bumpStats: (p: Partial<Stats>) => void
  checkAchievements: () => void

  // ——— бонусы
  claimDaily: () => number | null
  claimWheel: (value: number) => void
  claimRescue: () => boolean
  redeemPromo: (code: string) => { ok: boolean; msg: string }

  // ——— прочее
  setSettings: (p: Partial<Settings>) => void
  toast: (text: string) => void
  dropToast: (id: string) => void
  reset: () => void
  exportSave: () => string
  importSave: (data: string) => boolean
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      balance: START_BALANCE,
      xp: 0,
      inventory: [],
      fair: newFairState(),
      stats: { ...EMPTY_STATS },
      settings: { theme: 'auto', sound: true, haptics: true, fastMode: false, showDrops: true },
      messages: [],
      rounds: [],
      achievements: [],
      daily: { last: 0, streak: 0 },
      wheelLast: 0,
      rescueLast: 0,
      promos: [],
      toasts: [],
      createdAt: Date.now(),

      bet: (amount) => {
        if (amount <= 0 || get().balance < amount) return false
        set((s) => ({
          balance: s.balance - amount,
          stats: { ...s.stats, totalWagered: s.stats.totalWagered + amount },
        }))
        get().addXp(xpForBet(amount))
        return true
      },

      win: (amount) => {
        if (amount <= 0) return
        set((s) => {
          const balance = s.balance + amount
          return {
            balance,
            stats: {
              ...s.stats,
              totalWon: s.stats.totalWon + amount,
              maxBalance: Math.max(s.stats.maxBalance, balance),
              biggestWin: Math.max(s.stats.biggestWin, amount),
            },
          }
        })
      },

      recordWin: (amount) => {
        if (amount <= 0) return
        set((s) => ({
          stats: {
            ...s.stats,
            totalWon: s.stats.totalWon + amount,
            biggestWin: Math.max(s.stats.biggestWin, amount),
          },
        }))
      },

      addBalance: (amount) =>
        set((s) => ({
          balance: s.balance + amount,
          stats: { ...s.stats, maxBalance: Math.max(s.stats.maxBalance, s.balance + amount) },
        })),

      nextRoll: (cursor = 0) => {
        const f = get().fair
        const nonce = f.nonce + 1
        const roll = rollFloat(f.serverSeed, f.clientSeed, nonce, cursor)
        set({ fair: { ...f, nonce } })
        return { roll, nonce }
      },

      rotateSeeds: (clientSeed) => set((s) => ({ fair: newFairState(clientSeed, s.fair) })),
      setClientSeed: (cs) => set((s) => ({ fair: newFairState(cs.trim() || undefined, s.fair) })),

      addItem: (id) => {
        const it: InvItem = { uid: uid(), id, at: Date.now() }
        const def = ITEM_BY_ID[id]
        set((s) => ({
          inventory: [it, ...s.inventory],
          stats: { ...s.stats, bestItemPrice: Math.max(s.stats.bestItemPrice, def?.price ?? 0) },
        }))
        return it
      },

      sellItem: (u) => {
        const item = get().inventory.find((i) => i.uid === u)
        if (!item) return
        const price = Math.round((ITEM_BY_ID[item.id]?.price ?? 0) * SELL_RATE)
        set((s) => ({ inventory: s.inventory.filter((i) => i.uid !== u) }))
        get().addBalance(price)
        get().toast(`Продано за ${price.toLocaleString('ru-RU')} MX`)
      },

      sellAll: () => {
        const inv = get().inventory
        if (!inv.length) return
        const total = inv.reduce((s, i) => s + Math.round((ITEM_BY_ID[i.id]?.price ?? 0) * SELL_RATE), 0)
        set({ inventory: [] })
        get().addBalance(total)
        get().toast(`Продано ${inv.length} шт. за ${total.toLocaleString('ru-RU')} MX`)
      },

      removeItems: (uids) =>
        set((s) => ({ inventory: s.inventory.filter((i) => !uids.includes(i.uid)) })),

      logRound: (r) =>
        set((s) => ({
          rounds: [{ ...r, n: s.fair.nonce, ts: Date.now() }, ...s.rounds].slice(0, 120),
        })),

      pushResult: (r) =>
        set((s) => ({
          messages: [...s.messages, { id: uid(), chat: 'bot' as const, result: r, ts: Date.now() }].slice(-120),
        })),

      pushText: (text, out) =>
        set((s) => ({
          messages: [...s.messages, { id: uid(), chat: 'bot' as const, text, out, ts: Date.now() }].slice(-120),
        })),

      pushDrop: (m) =>
        set((s) => ({
          messages: [...s.messages, { ...m, id: uid(), chat: 'drops' as const, ts: Date.now() }].slice(-160),
        })),

      clearChat: () => set((s) => ({ messages: s.messages.filter((m) => m.chat !== 'bot') })),

      addXp: (n) => {
        const before = levelFromXp(get().xp).lvl
        set((s) => ({ xp: s.xp + n }))
        const after = levelFromXp(get().xp).lvl
        if (after > before) {
          get().addBalance(after * 150)
          get().toast(`🎉 Уровень ${after}! +${(after * 150).toLocaleString('ru-RU')} MX`)
        }
      },

      bumpStats: (p) => set((s) => ({ stats: { ...s.stats, ...p } })),

      checkAchievements: () => {
        const s = get()
        const st: AchStats = {
          ...s.stats,
          itemsOwned: s.inventory.length,
          level: levelFromXp(s.xp).lvl,
          streak: s.daily.streak,
        }
        const unlocked = ACHIEVEMENTS.filter(
          (a) => !s.achievements.includes(a.id) && a.check(st),
        )
        if (!unlocked.length) return
        set((prev) => ({ achievements: [...prev.achievements, ...unlocked.map((a) => a.id)] }))
        for (const a of unlocked) {
          get().addBalance(a.reward)
          get().toast(`${a.emo} ${a.name} +${a.reward.toLocaleString('ru-RU')} MX`)
          get().pushResult({
            kind: 'bonus', title: `Достижение: ${a.name}`, bet: 0,
            payout: a.reward, extra: a.desc,
          })
        }
      },

      claimDaily: () => {
        const { daily } = get()
        const now = Date.now()
        if (now - daily.last < DAILY_COOLDOWN) return null
        const streak = now - daily.last > DAILY_RESET ? 1 : Math.min(daily.streak + 1, 7)
        const reward = dailyReward(streak)
        set({ daily: { last: now, streak } })
        get().addBalance(reward)
        get().pushResult({
          kind: 'bonus', title: `Ежедневный бонус · день ${streak}`, bet: 0, payout: reward,
        })
        get().checkAchievements()
        return reward
      },

      claimWheel: (value) => {
        set({ wheelLast: Date.now() })
        get().addBalance(value)
        get().pushResult({ kind: 'bonus', title: 'Колесо дня', bet: 0, payout: value })
        get().checkAchievements()
      },

      claimRescue: () => {
        const s = get()
        if (s.balance > RESCUE_THRESHOLD) return false
        if (Date.now() - s.rescueLast < RESCUE_COOLDOWN) return false
        set({ rescueLast: Date.now() })
        get().addBalance(RESCUE_AMOUNT)
        get().pushResult({ kind: 'bonus', title: 'Спасательный круг', bet: 0, payout: RESCUE_AMOUNT })
        return true
      },

      redeemPromo: (code) => {
        const c = code.trim().toUpperCase()
        if (!c) return { ok: false, msg: 'Введите код' }
        if (get().promos.includes(c)) return { ok: false, msg: 'Код уже использован' }
        const p = PROMOS[c]
        if (!p) return { ok: false, msg: 'Неверный код' }
        set((s) => ({ promos: [...s.promos, c] }))
        get().addBalance(p.amount)
        get().pushResult({ kind: 'bonus', title: `Промокод ${c}`, bet: 0, payout: p.amount, extra: p.label })
        return { ok: true, msg: `+${p.amount.toLocaleString('ru-RU')} MX` }
      },

      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

      toast: (text) => {
        const id = uid()
        set((s) => ({ toasts: [...s.toasts, { id, text }] }))
        setTimeout(() => get().dropToast(id), 2600)
      },

      dropToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      reset: () =>
        set({
          balance: START_BALANCE, xp: 0, inventory: [], fair: newFairState(),
          stats: { ...EMPTY_STATS }, messages: [], rounds: [], achievements: [],
          daily: { last: 0, streak: 0 }, wheelLast: 0, rescueLast: 0, promos: [],
          createdAt: Date.now(),
        }),

      exportSave: () => {
        const s = get()
        return btoa(
          unescape(
            encodeURIComponent(
              JSON.stringify({
                balance: s.balance, xp: s.xp, inventory: s.inventory, stats: s.stats,
                achievements: s.achievements, daily: s.daily, promos: s.promos,
                settings: s.settings, createdAt: s.createdAt,
              }),
            ),
          ),
        )
      },

      importSave: (data) => {
        try {
          const o = JSON.parse(decodeURIComponent(escape(atob(data.trim()))))
          if (typeof o.balance !== 'number' || !Array.isArray(o.inventory)) return false
          set({
            balance: o.balance, xp: o.xp ?? 0, inventory: o.inventory,
            stats: { ...EMPTY_STATS, ...o.stats }, achievements: o.achievements ?? [],
            daily: o.daily ?? { last: 0, streak: 0 }, promos: o.promos ?? [],
            settings: { ...get().settings, ...o.settings },
            createdAt: o.createdAt ?? Date.now(),
          })
          return true
        } catch {
          return false
        }
      },
    }),
    {
      name: 'max-upgrader-save-v1',
      partialize: (s) => {
        const { toasts: _t, ...rest } = s
        return rest as GameState
      },
    },
  ),
)

/** Хелпер: предмет инвентаря → определение. */
export const defOf = (i: InvItem): ItemDef | undefined => ITEM_BY_ID[i.id]
