export type Rarity = 'common' | 'rare' | 'epic' | 'mythic' | 'legend' | 'divine'

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
  divine: 'var(--r-divine)',
}

export const RARITY_NAME: Record<Rarity, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  mythic: 'Мифический',
  legend: 'Легендарный',
  divine: 'Божественный',
}

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'mythic', 'legend', 'divine']

export function rarityOf(price: number): Rarity {
  if (price >= 1500000) return 'divine'
  if (price >= 250000) return 'legend'
  if (price >= 40000) return 'mythic'
  if (price >= 6000) return 'epic'
  if (price >= 700) return 'rare'
  return 'common'
}

/** Каталог «подарков и статусов мессенджера» вместо скинов. */
export const ITEMS: ItemDef[] = [
  // ——— обычные: стикеры, эмодзи, мелочь
  { id: 'sticker_cat', name: 'Стикер «Котик»', emo: '🐱', price: 30 },
  { id: 'sticker_meme', name: 'Стикер «Мем»', emo: '😹', price: 45 },
  { id: 'sticker_frog', name: 'Стикер «Лягух»', emo: '🐸', price: 60 },
  { id: 'sticker_bear', name: 'Стикер «Медведь»', emo: '🐻', price: 75 },
  { id: 'emoji_pack', name: 'Эмодзи-пак', emo: '😎', price: 95 },
  { id: 'emoji_rare', name: 'Редкое эмодзи', emo: '🥸', price: 120 },
  { id: 'reaction', name: 'Кастомная реакция', emo: '🔥', price: 150 },
  { id: 'reaction_rare', name: 'Реакция «Огонь»', emo: '💥', price: 185 },
  { id: 'wallpaper', name: 'Обои чата', emo: '🖼️', price: 225 },
  { id: 'wallpaper_anim', name: 'Живые обои', emo: '🌊', price: 270 },
  { id: 'sound', name: 'Звук уведомления', emo: '🔔', price: 320 },
  { id: 'sound_rare', name: 'Редкий рингтон', emo: '🎵', price: 375 },
  { id: 'gift_flower', name: 'Подарок «Букет»', emo: '💐', price: 430 },
  { id: 'gift_candy', name: 'Подарок «Конфета»', emo: '🍬', price: 490 },
  { id: 'gift_coffee', name: 'Подарок «Кофе»', emo: '☕', price: 550 },
  { id: 'gift_pizza', name: 'Подарок «Пицца»', emo: '🍕', price: 620 },
  { id: 'gift_cake', name: 'Подарок «Торт»', emo: '🎂', price: 680 },

  // ——— редкие
  { id: 'gift_heart', name: 'Подарок «Сердце»', emo: '💖', price: 760 },
  { id: 'gift_teddy', name: 'Подарок «Мишка»', emo: '🧸', price: 870 },
  { id: 'nick_color', name: 'Цветной ник', emo: '🎨', price: 980 },
  { id: 'gift_balloon', name: 'Подарок «Шарик»', emo: '🎈', price: 1100 },
  { id: 'theme_dark', name: 'Тёмная тема Pro', emo: '🌑', price: 1280 },
  { id: 'gift_guitar', name: 'Подарок «Гитара»', emo: '🎸', price: 1450 },
  { id: 'avatar_frame', name: 'Рамка аватара', emo: '🖼', price: 1650 },
  { id: 'gift_champagne', name: 'Подарок «Шампанское»', emo: '🍾', price: 1850 },
  { id: 'gift_ring', name: 'Подарок «Кольцо»', emo: '💍', price: 2100 },
  { id: 'gift_rocket', name: 'Подарок «Ракета»', emo: '🚀', price: 2400 },
  { id: 'sticker_anim', name: 'Анимированный стикерпак', emo: '✨', price: 2750 },
  { id: 'gift_trophy', name: 'Подарок «Кубок»', emo: '🏆', price: 3100 },
  { id: 'folder_pro', name: 'Папки чатов Pro', emo: '📂', price: 3500 },
  { id: 'gift_diamond_s', name: 'Подарок «Кристалл»', emo: '🔷', price: 3900 },
  { id: 'cloud', name: 'Облако 1 ТБ', emo: '☁️', price: 4400 },
  { id: 'gift_telescope', name: 'Подарок «Телескоп»', emo: '🔭', price: 4900 },
  { id: 'chat_pin', name: 'Безлимит закреплённых', emo: '📌', price: 5400 },

  // ——— эпические
  { id: 'avatar_anim', name: 'Анимированный аватар', emo: '🌀', price: 6200 },
  { id: 'gift_piano', name: 'Подарок «Рояль»', emo: '🎹', price: 6900 },
  { id: 'premium_1m', name: 'Премиум 1 месяц', emo: '💎', price: 7800 },
  { id: 'gift_camera', name: 'Подарок «Камера»', emo: '📸', price: 8600 },
  { id: 'badge_dev', name: 'Плашка «Разработчик»', emo: '👨‍💻', price: 9500 },
  { id: 'gift_moto', name: 'Подарок «Мотоцикл»', emo: '🏍️', price: 10800 },
  { id: 'nick_short', name: 'Короткий ник', emo: '🔤', price: 12000 },
  { id: 'gift_watch', name: 'Подарок «Часы»', emo: '⌚', price: 13500 },
  { id: 'gift_car', name: 'Подарок «Тачка»', emo: '🏎️', price: 15000 },
  { id: 'chat_ghost', name: 'Режим невидимки', emo: '👻', price: 16800 },
  { id: 'verify_blue', name: 'Синяя галочка', emo: '☑️', price: 18500 },
  { id: 'gift_violin', name: 'Подарок «Скрипка»', emo: '🎻', price: 20500 },
  { id: 'premium_1y', name: 'Премиум 1 год', emo: '💠', price: 23000 },
  { id: 'gift_gem', name: 'Подарок «Самоцвет»', emo: '💎', price: 26000 },
  { id: 'channel_1k', name: 'Канал 1 000 подписчиков', emo: '📣', price: 29000 },
  { id: 'gift_helicopter', name: 'Подарок «Вертолёт»', emo: '🚁', price: 33000 },
  { id: 'nick_gold', name: 'Золотой ник', emo: '🏅', price: 37000 },

  // ——— мифические
  { id: 'gift_yacht', name: 'Подарок «Яхта»', emo: '🛥️', price: 43000 },
  { id: 'chat_nolimit', name: 'Безлимит на всё', emo: '♾️', price: 49000 },
  { id: 'badge_admin', name: 'Плашка «Админ MAX»', emo: '🛡️', price: 56000 },
  { id: 'gift_castle', name: 'Подарок «Замок»', emo: '🏰', price: 64000 },
  { id: 'channel_100k', name: 'Канал 100 000', emo: '📡', price: 73000 },
  { id: 'gift_island', name: 'Подарок «Остров»', emo: '🏝️', price: 83000 },
  { id: 'gift_jet', name: 'Подарок «Джет»', emo: '✈️', price: 95000 },
  { id: 'badge_mod', name: 'Плашка «Модератор»', emo: '⚖️', price: 108000 },
  { id: 'gift_rocket_big', name: 'Подарок «Шаттл»', emo: '🛸', price: 124000 },
  { id: 'channel_1m', name: 'Канал 1 000 000', emo: '🌐', price: 142000 },
  { id: 'gift_volcano', name: 'Подарок «Вулкан»', emo: '🌋', price: 163000 },
  { id: 'verify_gold', name: 'Золотая галочка', emo: '🥇', price: 190000 },
  { id: 'gift_galaxy', name: 'Подарок «Галактика»', emo: '🌌', price: 220000 },

  // ——— легендарные
  { id: 'gift_crown', name: 'Корона MAX', emo: '👑', price: 280000 },
  { id: 'badge_owner', name: 'Плашка «Владелец»', emo: '🔱', price: 340000 },
  { id: 'gift_meteor', name: 'Подарок «Метеорит»', emo: '☄️', price: 420000 },
  { id: 'server_max', name: 'Свой сервер MAX', emo: '🖥️', price: 520000 },
  { id: 'gift_blackhole', name: 'Подарок «Чёрная дыра»', emo: '🕳️', price: 650000 },
  { id: 'nick_any', name: 'Любой ник навсегда', emo: '📛', price: 800000 },
  { id: 'gift_planet', name: 'Подарок «Планета»', emo: '🪐', price: 980000 },
  { id: 'datacenter', name: 'Дата-центр MAX', emo: '🏭', price: 1200000 },

  // ——— божественные
  { id: 'max_itself', name: 'Мессенджер MAX', emo: '🦄', price: 1800000 },
  { id: 'gift_universe', name: 'Подарок «Вселенная»', emo: '🌠', price: 2600000 },
  { id: 'source_code', name: 'Исходный код MAX', emo: '📜', price: 4200000 },
  { id: 'the_key', name: 'Ключ от всего', emo: '🗝️', price: 6800000 },
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
