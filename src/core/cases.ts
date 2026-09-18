import { ITEM_BY_ID, ItemDef } from './items'

export interface CaseDrop { id: string; weight: number }
export interface CaseDef {
  id: string
  name: string
  emo: string
  price: number
  tint: string
  drops: CaseDrop[]
}

/** Веса убывают с ростом цены предмета; цена кейса подобрана под RTP ≈ 90%. */
export const CASES: CaseDef[] = [
  {
    id: 'starter', name: 'Стартовый', emo: '📦', price: 60,
    tint: '#9AA3B2',
    drops: [
      { id: 'sticker_cat', weight: 320 },
      { id: 'sticker_meme', weight: 250 },
      { id: 'sticker_frog', weight: 180 },
      { id: 'sticker_bear', weight: 120 },
      { id: 'emoji_pack', weight: 75 },
      { id: 'emoji_rare', weight: 34 },
      { id: 'reaction', weight: 14 },
      { id: 'wallpaper', weight: 5 },
      { id: 'gift_flower', weight: 1.6 },
      { id: 'nick_color', weight: 0.3 },
    ],
  },
  {
    id: 'emoji', name: 'Эмодзи', emo: '😎', price: 130,
    tint: '#FFC53D',
    drops: [
      { id: 'sticker_bear', weight: 300 },
      { id: 'emoji_pack', weight: 245 },
      { id: 'emoji_rare', weight: 185 },
      { id: 'reaction', weight: 130 },
      { id: 'reaction_rare', weight: 80 },
      { id: 'wallpaper', weight: 42 },
      { id: 'sound', weight: 14 },
      { id: 'gift_flower', weight: 3.4 },
      { id: 'gift_heart', weight: 0.7 },
      { id: 'sticker_anim', weight: 0.08 },
    ],
  },
  {
    id: 'stickers', name: 'Стикерпак', emo: '🎨', price: 300,
    tint: '#3B82F6',
    drops: [
      { id: 'reaction_rare', weight: 290 },
      { id: 'wallpaper', weight: 235 },
      { id: 'wallpaper_anim', weight: 180 },
      { id: 'sound', weight: 130 },
      { id: 'sound_rare', weight: 85 },
      { id: 'gift_flower', weight: 50 },
      { id: 'gift_candy', weight: 22 },
      { id: 'gift_cake', weight: 6.4 },
      { id: 'nick_color', weight: 1.4 },
      { id: 'theme_dark', weight: 0.25 },
      { id: 'sticker_anim', weight: 0.04 },
    ],
  },
  {
    id: 'gifts', name: 'Подарочный', emo: '🎁', price: 690,
    tint: '#F0468C',
    drops: [
      { id: 'gift_candy', weight: 280 },
      { id: 'gift_coffee', weight: 230 },
      { id: 'gift_pizza', weight: 185 },
      { id: 'gift_cake', weight: 140 },
      { id: 'gift_heart', weight: 92 },
      { id: 'gift_teddy', weight: 52 },
      { id: 'nick_color', weight: 25 },
      { id: 'gift_balloon', weight: 10 },
      { id: 'gift_guitar', weight: 2.8 },
      { id: 'gift_ring', weight: 0.55 },
      { id: 'gift_rocket', weight: 0.09 },
    ],
  },
  {
    id: 'night', name: 'Ночной', emo: '🌑', price: 1410,
    tint: '#6B7280',
    drops: [
      { id: 'wallpaper_anim', weight: 275 },
      { id: 'theme_dark', weight: 220 },
      { id: 'gift_guitar', weight: 175 },
      { id: 'avatar_frame', weight: 130 },
      { id: 'gift_champagne', weight: 90 },
      { id: 'gift_ring', weight: 55 },
      { id: 'gift_rocket', weight: 30 },
      { id: 'sticker_anim', weight: 14 },
      { id: 'folder_pro', weight: 5.2 },
      { id: 'chat_ghost', weight: 1.3 },
      { id: 'verify_blue', weight: 0.28 },
      { id: 'badge_admin', weight: 0.03 },
    ],
  },
  {
    id: 'premium', name: 'Премиум', emo: '💎', price: 4500,
    tint: '#A855F7',
    drops: [
      { id: 'gift_trophy', weight: 270 },
      { id: 'folder_pro', weight: 215 },
      { id: 'gift_diamond_s', weight: 170 },
      { id: 'cloud', weight: 128 },
      { id: 'gift_telescope', weight: 92 },
      { id: 'chat_pin', weight: 60 },
      { id: 'avatar_anim', weight: 36 },
      { id: 'premium_1m', weight: 18 },
      { id: 'badge_dev', weight: 7.4 },
      { id: 'nick_short', weight: 2.4 },
      { id: 'verify_blue', weight: 0.6 },
      { id: 'premium_1y', weight: 0.1 },
    ],
  },
  {
    id: 'channel', name: 'Канал', emo: '📣', price: 9900,
    tint: '#F0468C',
    drops: [
      { id: 'avatar_anim', weight: 265 },
      { id: 'premium_1m', weight: 210 },
      { id: 'gift_camera', weight: 165 },
      { id: 'badge_dev', weight: 125 },
      { id: 'gift_moto', weight: 90 },
      { id: 'nick_short', weight: 60 },
      { id: 'gift_car', weight: 36 },
      { id: 'verify_blue', weight: 18 },
      { id: 'premium_1y', weight: 7.2 },
      { id: 'channel_1k', weight: 2.4 },
      { id: 'nick_gold', weight: 0.62 },
      { id: 'gift_yacht', weight: 0.12 },
      { id: 'channel_100k', weight: 0.02 },
    ],
  },
  {
    id: 'admin', name: 'Админский', emo: '🛡️', price: 21400,
    tint: '#3DD68C',
    drops: [
      { id: 'gift_car', weight: 260 },
      { id: 'chat_ghost', weight: 205 },
      { id: 'verify_blue', weight: 160 },
      { id: 'gift_violin', weight: 120 },
      { id: 'premium_1y', weight: 88 },
      { id: 'gift_gem', weight: 58 },
      { id: 'channel_1k', weight: 35 },
      { id: 'gift_helicopter', weight: 18 },
      { id: 'nick_gold', weight: 8.2 },
      { id: 'gift_yacht', weight: 3.1 },
      { id: 'badge_admin', weight: 0.95 },
      { id: 'channel_100k', weight: 0.22 },
      { id: 'badge_mod', weight: 0.04 },
    ],
  },
  {
    id: 'space', name: 'Космос', emo: '🚀', price: 56600,
    tint: '#7C5CFF',
    drops: [
      { id: 'nick_gold', weight: 255 },
      { id: 'gift_yacht', weight: 200 },
      { id: 'chat_nolimit', weight: 155 },
      { id: 'badge_admin', weight: 115 },
      { id: 'gift_castle', weight: 82 },
      { id: 'channel_100k', weight: 54 },
      { id: 'gift_island', weight: 32 },
      { id: 'gift_jet', weight: 17 },
      { id: 'badge_mod', weight: 7.8 },
      { id: 'gift_rocket_big', weight: 3.2 },
      { id: 'channel_1m', weight: 1.1 },
      { id: 'gift_volcano', weight: 0.3 },
      { id: 'verify_gold', weight: 0.06 },
    ],
  },
  {
    id: 'legend', name: 'Легендарный', emo: '👑', price: 145000,
    tint: '#FFC53D',
    drops: [
      { id: 'gift_jet', weight: 250 },
      { id: 'badge_mod', weight: 196 },
      { id: 'gift_rocket_big', weight: 150 },
      { id: 'channel_1m', weight: 112 },
      { id: 'gift_volcano', weight: 78 },
      { id: 'verify_gold', weight: 50 },
      { id: 'gift_galaxy', weight: 29 },
      { id: 'gift_crown', weight: 15 },
      { id: 'badge_owner', weight: 6.8 },
      { id: 'gift_meteor', weight: 2.6 },
      { id: 'server_max', weight: 0.82 },
      { id: 'gift_blackhole', weight: 0.2 },
      { id: 'nick_any', weight: 0.04 },
    ],
  },
  {
    id: 'mythic', name: 'Мифический', emo: '🌌', price: 510000,
    tint: '#F0468C',
    drops: [
      { id: 'gift_crown', weight: 245 },
      { id: 'badge_owner', weight: 190 },
      { id: 'gift_meteor', weight: 146 },
      { id: 'server_max', weight: 108 },
      { id: 'gift_blackhole', weight: 74 },
      { id: 'nick_any', weight: 46 },
      { id: 'gift_planet', weight: 26 },
      { id: 'datacenter', weight: 12.5 },
      { id: 'max_itself', weight: 5.2 },
      { id: 'gift_universe', weight: 1.7 },
      { id: 'source_code', weight: 0.42 },
      { id: 'the_key', weight: 0.07 },
    ],
  },
  {
    id: 'divine', name: 'Божественный', emo: '🗝️', price: 1270000,
    tint: '#00D3C7',
    drops: [
      { id: 'gift_blackhole', weight: 240 },
      { id: 'nick_any', weight: 188 },
      { id: 'gift_planet', weight: 144 },
      { id: 'datacenter', weight: 106 },
      { id: 'max_itself', weight: 72 },
      { id: 'gift_universe', weight: 42 },
      { id: 'source_code', weight: 19 },
      { id: 'the_key', weight: 6.4 },
    ],
  },
]

export const CASE_BY_ID: Record<string, CaseDef> = Object.fromEntries(CASES.map((c) => [c.id, c]))

export function totalWeight(c: CaseDef) {
  return c.drops.reduce((s, d) => s + d.weight, 0)
}

export function dropChance(c: CaseDef, dropId: string) {
  const t = totalWeight(c)
  const d = c.drops.find((x) => x.id === dropId)
  return d ? d.weight / t : 0
}

/** Детерминированный выбор дропа по числу roll ∈ [0,1). */
export function pickDrop(c: CaseDef, roll: number): ItemDef {
  const t = totalWeight(c)
  let acc = 0
  const target = roll * t
  for (const d of c.drops) {
    acc += d.weight
    if (target < acc) return ITEM_BY_ID[d.id]
  }
  return ITEM_BY_ID[c.drops[c.drops.length - 1].id]
}

/** Ожидаемая отдача кейса — для отображения «честного» RTP. */
export function caseRtp(c: CaseDef) {
  const t = totalWeight(c)
  const ev = c.drops.reduce((s, d) => s + (d.weight / t) * ITEM_BY_ID[d.id].price, 0)
  return ev / c.price
}
