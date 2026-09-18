export const START_BALANCE = 1000
export const UPGRADE_RTP = 0.92
export const MIN_MULT = 1.05
export const MAX_MULT = 50
export const SELL_RATE = 0.9 // возврат при продаже предмета

/** Сколько XP даёт ставка. */
export const xpForBet = (bet: number) => Math.max(1, Math.round(Math.sqrt(bet) / 2))

/** Кумулятивный XP для уровня n. */
export const xpForLevel = (lvl: number) => Math.round(60 * Math.pow(Math.max(0, lvl - 1), 1.7))

export function levelFromXp(xp: number) {
  let lvl = 1
  while (xp >= xpForLevel(lvl + 1) && lvl < 120) lvl++
  const cur = xpForLevel(lvl)
  const next = xpForLevel(lvl + 1)
  return { lvl, cur, next, progress: Math.max(0, Math.min(1, (xp - cur) / (next - cur))) }
}

export const TITLES: { lvl: number; name: string }[] = [
  { lvl: 1, name: 'Новичок' },
  { lvl: 3, name: 'Читатель чатов' },
  { lvl: 6, name: 'Активный юзер' },
  { lvl: 10, name: 'Стикер-дилер' },
  { lvl: 15, name: 'Админ канала' },
  { lvl: 21, name: 'Верифицированный' },
  { lvl: 28, name: 'Инвестор MAX' },
  { lvl: 36, name: 'Легенда чатов' },
  { lvl: 45, name: 'Владелец сервера' },
  { lvl: 60, name: 'Господин МАКС' },
]

export const titleFor = (lvl: number) =>
  [...TITLES].reverse().find((t) => lvl >= t.lvl)?.name ?? 'Новичок'

/** Ежедневный бонус: растёт со стриком, х3 на седьмой день. */
export const dailyReward = (streak: number) => {
  const s = Math.min(streak, 7)
  return Math.round(200 * (1 + (s - 1) * 0.35) * (s === 7 ? 3 : 1))
}

export const DAILY_COOLDOWN = 20 * 60 * 60 * 1000 // 20 ч
export const DAILY_RESET = 44 * 60 * 60 * 1000 // стрик сгорает через 44 ч
export const WHEEL_COOLDOWN = 8 * 60 * 60 * 1000
export const RESCUE_COOLDOWN = 15 * 60 * 1000
export const RESCUE_AMOUNT = 100
export const RESCUE_THRESHOLD = 50

/** Сектора «колеса дня». */
export const WHEEL_SECTORS = [
  { label: '50', value: 50, weight: 260 },
  { label: '100', value: 100, weight: 230 },
  { label: '200', value: 200, weight: 190 },
  { label: '350', value: 350, weight: 140 },
  { label: '600', value: 600, weight: 90 },
  { label: '1 000', value: 1000, weight: 55 },
  { label: '2 500', value: 2500, weight: 25 },
  { label: '10 000', value: 10000, weight: 8 },
  { label: '50 000', value: 50000, weight: 2 },
]

export const PROMOS: Record<string, { amount: number; label: string }> = {
  MAX: { amount: 500, label: 'Добро пожаловать в MAX' },
  UPGRADE: { amount: 1000, label: 'Апгрейд стартовал' },
  STICKER: { amount: 750, label: 'Стикерпак в подарок' },
  GOLD: { amount: 5000, label: 'Золотой бонус' },
  CHAT2026: { amount: 2500, label: 'Чат года' },
}

export interface AchDef {
  id: string
  name: string
  desc: string
  emo: string
  reward: number
  check: (s: AchStats) => boolean
}

export interface AchStats {
  spins: number
  wins: number
  losses: number
  bestMult: number
  biggestWin: number
  casesOpened: number
  itemsOwned: number
  bestItemPrice: number
  maxBalance: number
  minesCashouts: number
  crashCashouts: number
  bestCrash: number
  contracts: number
  battlesWon: number
  totalWagered: number
  level: number
  streak: number
}

export const ACHIEVEMENTS: AchDef[] = [
  { id: 'first_spin', name: 'Первый апгрейд', desc: 'Крутани колесо один раз', emo: '🎰', reward: 100, check: (s) => s.spins >= 1 },
  { id: 'spin_50', name: 'Разогрелся', desc: '50 апгрейдов', emo: '🔄', reward: 300, check: (s) => s.spins >= 50 },
  { id: 'spin_500', name: 'Марафонец', desc: '500 апгрейдов', emo: '🏃', reward: 2000, check: (s) => s.spins >= 500 },
  { id: 'mult_5', name: 'Рискнул', desc: 'Победа на x5 и выше', emo: '🎯', reward: 400, check: (s) => s.bestMult >= 5 },
  { id: 'mult_10', name: 'Дерзкий', desc: 'Победа на x10 и выше', emo: '⚡', reward: 1200, check: (s) => s.bestMult >= 10 },
  { id: 'mult_25', name: 'Безумец', desc: 'Победа на x25 и выше', emo: '🤯', reward: 5000, check: (s) => s.bestMult >= 25 },
  { id: 'mult_50', name: 'Невозможное', desc: 'Победа на x50', emo: '🌟', reward: 25000, check: (s) => s.bestMult >= 50 },
  { id: 'win_10k', name: 'Крупный куш', desc: 'Выиграй 10 000 за раз', emo: '💰', reward: 1000, check: (s) => s.biggestWin >= 10000 },
  { id: 'win_100k', name: 'Миллионер в пути', desc: 'Выиграй 100 000 за раз', emo: '🤑', reward: 10000, check: (s) => s.biggestWin >= 100000 },
  { id: 'bal_100k', name: 'Сотка', desc: 'Баланс 100 000 MX', emo: '🏦', reward: 3000, check: (s) => s.maxBalance >= 100000 },
  { id: 'bal_1m', name: 'Миллион', desc: 'Баланс 1 000 000 MX', emo: '💸', reward: 50000, check: (s) => s.maxBalance >= 1000000 },
  { id: 'case_1', name: 'Распаковщик', desc: 'Открой первый кейс', emo: '📦', reward: 100, check: (s) => s.casesOpened >= 1 },
  { id: 'case_100', name: 'Коллекционер', desc: 'Открой 100 кейсов', emo: '🎁', reward: 2500, check: (s) => s.casesOpened >= 100 },
  { id: 'inv_10', name: 'Полки ломятся', desc: '10 предметов в инвентаре', emo: '🎒', reward: 500, check: (s) => s.itemsOwned >= 10 },
  { id: 'item_verify', name: 'Заветная галочка', desc: 'Получи предмет дороже 18 000', emo: '☑️', reward: 3000, check: (s) => s.bestItemPrice >= 18000 },
  { id: 'item_legend', name: 'Легендарный дроп', desc: 'Получи предмет дороже 100 000', emo: '👑', reward: 15000, check: (s) => s.bestItemPrice >= 100000 },
  { id: 'mines_5', name: 'Сапёр', desc: '5 успешных выводов в Минах', emo: '💣', reward: 600, check: (s) => s.minesCashouts >= 5 },
  { id: 'crash_10x', name: 'Космос', desc: 'Забери на x10 в Краше', emo: '🚀', reward: 2000, check: (s) => s.bestCrash >= 10 },
  { id: 'crash_25', name: 'Хладнокровие', desc: '25 выводов в Краше', emo: '📈', reward: 1500, check: (s) => s.crashCashouts >= 25 },
  { id: 'contract_10', name: 'Контрактник', desc: '10 контрактов', emo: '📝', reward: 800, check: (s) => s.contracts >= 10 },
  { id: 'battle_5', name: 'Боец', desc: 'Выиграй 5 битв', emo: '⚔️', reward: 1500, check: (s) => s.battlesWon >= 5 },
  { id: 'wager_1m', name: 'Оборотистый', desc: 'Прокрути 1 000 000 MX', emo: '🔁', reward: 8000, check: (s) => s.totalWagered >= 1000000 },
  { id: 'wager_10m', name: 'Кит', desc: 'Прокрути 10 000 000 MX', emo: '🐋', reward: 60000, check: (s) => s.totalWagered >= 10000000 },
  { id: 'lvl_10', name: 'Десятка', desc: 'Достигни 10 уровня', emo: '🔟', reward: 1500, check: (s) => s.level >= 10 },
  { id: 'lvl_25', name: 'Ветеран', desc: 'Достигни 25 уровня', emo: '🎖️', reward: 8000, check: (s) => s.level >= 25 },
  { id: 'streak_7', name: 'Неделя в MAX', desc: 'Стрик 7 дней', emo: '📅', reward: 3000, check: (s) => s.streak >= 7 },
  { id: 'lose_100', name: 'Не сдаюсь', desc: '100 проигрышей', emo: '🪦', reward: 700, check: (s) => s.losses >= 100 },
  { id: 'win_100', name: 'Везунчик', desc: '100 побед', emo: '🍀', reward: 1500, check: (s) => s.wins >= 100 },
]

export const fmt = (n: number) =>
  Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ')

export const fmtShort = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + ' млрд'
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' млн'
  if (a >= 1e4) return (n / 1e3).toFixed(0) + 'K'
  return fmt(n)
}
