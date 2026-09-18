export type Rarity = 'common' | 'rare' | 'epic' | 'mythic' | 'legend'

export interface ItemDef {
  id: string
  name: string
  emo: string
  price: number
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: 'var(--r-common)',
  rare: 'var(--r-rare)',
  epic: 'var(--r-epic)',
  mythic: 'var(--r-mythic)',
  legend: 'var(--r-legend)',
}

export const RARITY_NAME: Record<Rarity, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  mythic: 'Мифический',
  legend: 'Легендарный',
}

export function rarityOf(price: number): Rarity {
  if (price >= 100000) return 'legend'
  if (price >= 25000) return 'mythic'
  if (price >= 5000) return 'epic'
  if (price >= 800) return 'rare'
  return 'common'
}

/** Каталог «подарков и статусов мессенджера» вместо скинов. */
export const ITEMS: ItemDef[] = [
  { id: 'sticker_cat', name: 'Стикер «Котик»', emo: '🐱', price: 50 },
  { id: 'sticker_meme', name: 'Стикер «Мем»', emo: '😹', price: 90 },
  { id: 'emoji_pack', name: 'Эмодзи-пак', emo: '😎', price: 140 },
  { id: 'reaction', name: 'Кастомная реакция', emo: '🔥', price: 200 },
  { id: 'wallpaper', name: 'Обои чата', emo: '🖼️', price: 280 },
  { id: 'sound', name: 'Звук уведомления', emo: '🔔', price: 360 },
  { id: 'gift_flower', name: 'Подарок «Букет»', emo: '💐', price: 450 },
  { id: 'gift_cake', name: 'Подарок «Торт»', emo: '🎂', price: 600 },
  { id: 'gift_heart', name: 'Подарок «Сердце»', emo: '💖', price: 780 },

  { id: 'nick_color', name: 'Цветной ник', emo: '🎨', price: 1000 },
  { id: 'theme_dark', name: 'Тёмная тема Pro', emo: '🌑', price: 1400 },
  { id: 'avatar_frame', name: 'Рамка аватара', emo: '🖼', price: 1800 },
  { id: 'gift_rocket', name: 'Подарок «Ракета»', emo: '🚀', price: 2400 },
  { id: 'sticker_anim', name: 'Анимированный стикерпак', emo: '✨', price: 3000 },
  { id: 'folder_pro', name: 'Папки чатов Pro', emo: '📂', price: 3600 },
  { id: 'cloud', name: 'Облако 1 ТБ', emo: '☁️', price: 4400 },

  { id: 'avatar_anim', name: 'Анимированный аватар', emo: '🌀', price: 5500 },
  { id: 'premium_1m', name: 'Премиум 1 месяц', emo: '💎', price: 7000 },
  { id: 'badge_dev', name: 'Плашка «Разработчик»', emo: '👨‍💻', price: 9000 },
  { id: 'nick_short', name: 'Короткий ник', emo: '🔤', price: 11000 },
  { id: 'gift_car', name: 'Подарок «Тачка»', emo: '🏎️', price: 14000 },
  { id: 'verify_blue', name: 'Синяя галочка', emo: '☑️', price: 18000 },
  { id: 'premium_1y', name: 'Премиум 1 год', emo: '💠', price: 22000 },

  { id: 'channel_1k', name: 'Канал 1 000 подписчиков', emo: '📣', price: 26000 },
  { id: 'nick_gold', name: 'Золотой ник', emo: '🏅', price: 34000 },
  { id: 'gift_yacht', name: 'Подарок «Яхта»', emo: '🛥️', price: 42000 },
  { id: 'badge_admin', name: 'Плашка «Админ MAX»', emo: '🛡️', price: 55000 },
  { id: 'channel_100k', name: 'Канал 100 000', emo: '📡', price: 70000 },
  { id: 'gift_jet', name: 'Подарок «Джет»', emo: '✈️', price: 88000 },

  { id: 'channel_1m', name: 'Канал 1 000 000', emo: '🌐', price: 120000 },
  { id: 'verify_gold', name: 'Золотая галочка', emo: '🥇', price: 180000 },
  { id: 'gift_crown', name: 'Корона MAX', emo: '👑', price: 300000 },
  { id: 'server_max', name: 'Свой сервер MAX', emo: '🖥️', price: 650000 },
  { id: 'max_itself', name: 'Мессенджер MAX', emo: '🦄', price: 1500000 },
]

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(
  ITEMS.map((i) => [i.id, i]),
)

export const sortedByPrice = [...ITEMS].sort((a, b) => a.price - b.price)

/** Ближайший предмет к заданной стоимости (для апгрейда/контракта). */
export function nearestItem(price: number, exclude?: string): ItemDef {
  let best = sortedByPrice[0]
  let bestD = Infinity
  for (const it of sortedByPrice) {
    if (it.id === exclude) continue
    const d = Math.abs(it.price - price)
    if (d < bestD) { bestD = d; best = it }
  }
  return best
}

/** Предметы в заданном ценовом коридоре. */
export function itemsInRange(min: number, max: number): ItemDef[] {
  return sortedByPrice.filter((i) => i.price >= min && i.price <= max)
}
