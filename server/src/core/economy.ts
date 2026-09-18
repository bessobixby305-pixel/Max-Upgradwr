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

export interface PromoDef {
  /** сколько MX начислить */
  amount?: number
  /** какие предметы выдать */
  items?: string[]
  label: string
}

/** Промокоды. Регистр не важен — код приводится к верхнему при вводе. */
export const PROMOS: Record<string, PromoDef> = {
  // ——— стартовые
  MAX: { amount: 500, label: 'Добро пожаловать в MAX' },
  UPGRADE: { amount: 1000, label: 'Апгрейд стартовал' },
  STICKER: { amount: 750, label: 'Стикерпак в подарок' },
  START: { amount: 600, label: 'Первые шаги' },
  HELLO: { amount: 400, label: 'Привет!' },
  NEWBIE: { amount: 850, label: 'Новичкам везёт' },
  BONUS: { amount: 1200, label: 'Просто бонус' },
  FREE: { amount: 700, label: 'Бесплатно' },
  GIFT: { amount: 1500, label: 'Подарок' },
  LUCKY: { amount: 1750, label: 'Удача на твоей стороне' },

  // ——— средние
  CHAT2026: { amount: 2500, label: 'Чат года' },
  MESSENGER: { amount: 2200, label: 'Лучший мессенджер' },
  SPIN: { amount: 2000, label: 'Крути дальше' },
  WHEEL: { amount: 2800, label: 'Колесо фортуны' },
  CASE: { amount: 3000, label: 'На кейсы' },
  DROP: { amount: 3300, label: 'Хорошего дропа' },
  MINES: { amount: 2600, label: 'Сапёр ошибается один раз' },
  CRASH: { amount: 3500, label: 'Успей забрать' },
  TOWER: { amount: 3800, label: 'Выше только звёзды' },
  DICE: { amount: 2400, label: 'Бросай кости' },
  DOUBLE: { amount: 4000, label: 'Красное или чёрное' },
  SLOTS: { amount: 4200, label: 'Три семёрки' },
  JACKPOT: { amount: 4500, label: 'Сорви банк' },
  BATTLE: { amount: 3600, label: 'В бой' },
  CONTRACT: { amount: 3100, label: 'Сплавь ненужное' },

  // ——— крупные
  GOLD: { amount: 5000, label: 'Золотой бонус' },
  SILVER: { amount: 4800, label: 'Серебряный бонус' },
  PLATINUM: { amount: 7500, label: 'Платиновый бонус' },
  DIAMOND: { amount: 10000, label: 'Алмазный бонус' },
  PREMIUM: { amount: 12000, label: 'Премиум-статус' },
  VIP: { amount: 15000, label: 'VIP-доступ' },
  ELITE: { amount: 18000, label: 'Элита' },
  BOSS: { amount: 22000, label: 'Босс чата' },
  LEGEND: { amount: 30000, label: 'Легенда' },
  MYTHIC: { amount: 45000, label: 'Миф' },
  DIVINE: { amount: 75000, label: 'Божественно' },
  WHALE: { amount: 120000, label: 'Кит' },
  MILLION: { amount: 250000, label: 'Путь к миллиону' },

  // ——— предметные
  CAT: { items: ['sticker_cat', 'sticker_meme', 'sticker_frog'], label: 'Три стикера' },
  EMOJI: { items: ['emoji_pack', 'emoji_rare'], label: 'Эмодзи-набор' },
  FLOWERS: { items: ['gift_flower', 'gift_candy'], label: 'Букет и конфета' },
  SWEET: { items: ['gift_cake', 'gift_coffee', 'gift_pizza'], label: 'Сладкий стол' },
  HEART: { items: ['gift_heart', 'gift_teddy'], label: 'От всего сердца' },
  DARK: { items: ['theme_dark'], label: 'Тёмная сторона' },
  ROCKET: { items: ['gift_rocket'], label: 'Поехали' },
  CLOUD: { items: ['cloud'], label: 'Облако на терабайт' },
  VERIFY: { items: ['verify_blue'], label: 'Синяя галочка' },
  CHANNEL: { items: ['channel_1k'], label: 'Свой канал' },
  CROWN: { items: ['gift_crown'], label: 'Корона MAX' },
  UNICORN: { items: ['max_itself'], label: 'Тот самый единорог' },

  // ——— смешанные
  COMBO: { amount: 5000, items: ['gift_rocket', 'sticker_anim'], label: 'Комбо' },
  ALLIN: { amount: 50000, items: ['nick_gold', 'premium_1y'], label: 'Ва-банк' },
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
  promosUsed: number
  towerCashouts: number
  towerBestFloor: number
  slotSpins: number
  slotJackpots: number
  doubleGreens: number
  diceWins: number
  jackpotWins: number
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

  // ——— новые режимы
  { id: 'tower_top', name: 'На вершине', desc: 'Пройди башню до 8 этажа', emo: '🗼', reward: 6000, check: (s) => s.towerBestFloor >= 8 },
  { id: 'tower_10', name: 'Верхолаз', desc: '10 выводов в Башне', emo: '🧗', reward: 1800, check: (s) => s.towerCashouts >= 10 },
  { id: 'slots_100', name: 'Однорукий бандит', desc: '100 спинов в Слотах', emo: '🎰', reward: 1600, check: (s) => s.slotSpins >= 100 },
  { id: 'slots_jack', name: 'Три семёрки', desc: 'Собери джекпот в Слотах', emo: '7️⃣', reward: 12000, check: (s) => s.slotJackpots >= 1 },
  { id: 'double_green', name: 'Зелёный', desc: 'Поймай зелёное в Дабле', emo: '🟢', reward: 4000, check: (s) => s.doubleGreens >= 1 },
  { id: 'double_green_5', name: 'Зелёный охотник', desc: '5 раз поймай зелёное', emo: '🍏', reward: 15000, check: (s) => s.doubleGreens >= 5 },
  { id: 'dice_50', name: 'Костолом', desc: '50 побед в Костях', emo: '🎲', reward: 2200, check: (s) => s.diceWins >= 50 },
  { id: 'jackpot_1', name: 'Сорвал банк', desc: 'Выиграй Джекпот', emo: '🏦', reward: 3000, check: (s) => s.jackpotWins >= 1 },
  { id: 'jackpot_10', name: 'Хозяин банка', desc: 'Выиграй Джекпот 10 раз', emo: '💼', reward: 20000, check: (s) => s.jackpotWins >= 10 },
  { id: 'item_divine', name: 'Божественный дроп', desc: 'Получи предмет дороже 1 500 000', emo: '🗝️', reward: 100000, check: (s) => s.bestItemPrice >= 1500000 },
  { id: 'promo_10', name: 'Охотник за кодами', desc: 'Активируй 10 промокодов', emo: '🎟️', reward: 5000, check: (s) => s.promosUsed >= 10 },
  { id: 'promo_all', name: 'Все коды мира', desc: 'Активируй 30 промокодов', emo: '🗂️', reward: 40000, check: (s) => s.promosUsed >= 30 },
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
