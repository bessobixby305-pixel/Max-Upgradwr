import { ITEM_BY_ID, ItemDef } from './items'

export interface CaseDrop { id: string; weight: number }
export interface CaseDef {
  id: string
  name: string
  emo: string
  price: number
  grad: string
  drops: CaseDrop[]
}

export const CASES: CaseDef[] = [
  {
    id: 'starter', name: 'Стартовый', emo: '📦', price: 140,
    grad: 'linear-gradient(135deg,#8E99A8,#5C6673)',
    drops: [
      { id: 'sticker_cat', weight: 340 },
      { id: 'sticker_meme', weight: 260 },
      { id: 'emoji_pack', weight: 180 },
      { id: 'reaction', weight: 110 },
      { id: 'wallpaper', weight: 62 },
      { id: 'sound', weight: 32 },
      { id: 'gift_flower', weight: 12 },
      { id: 'gift_heart', weight: 3.4 },
      { id: 'nick_color', weight: 0.6 },
    ],
  },
  {
    id: 'stickers', name: 'Стикерпак', emo: '🎨', price: 400,
    grad: 'linear-gradient(135deg,#3F8CFF,#2A5CD6)',
    drops: [
      { id: 'reaction', weight: 300 },
      { id: 'wallpaper', weight: 240 },
      { id: 'sound', weight: 180 },
      { id: 'gift_flower', weight: 130 },
      { id: 'gift_cake', weight: 90 },
      { id: 'gift_heart', weight: 42 },
      { id: 'nick_color', weight: 14 },
      { id: 'theme_dark', weight: 3.2 },
      { id: 'sticker_anim', weight: 0.7 },
      { id: 'avatar_anim', weight: 0.1 },
    ],
  },
  {
    id: 'premium', name: 'Премиум', emo: '💎', price: 1330,
    grad: 'linear-gradient(135deg,#A25CFF,#6A2FD6)',
    drops: [
      { id: 'gift_cake', weight: 280 },
      { id: 'gift_heart', weight: 230 },
      { id: 'nick_color', weight: 190 },
      { id: 'theme_dark', weight: 140 },
      { id: 'gift_rocket', weight: 95 },
      { id: 'sticker_anim', weight: 44 },
      { id: 'cloud', weight: 15 },
      { id: 'avatar_anim', weight: 4.6 },
      { id: 'premium_1m', weight: 1.1 },
      { id: 'verify_blue', weight: 0.2 },
      { id: 'channel_1k', weight: 0.03 },
    ],
  },
  {
    id: 'channel', name: 'Канал', emo: '📣', price: 5280,
    grad: 'linear-gradient(135deg,#FF4FA3,#C41E6B)',
    drops: [
      { id: 'sticker_anim', weight: 270 },
      { id: 'folder_pro', weight: 220 },
      { id: 'cloud', weight: 175 },
      { id: 'avatar_anim', weight: 130 },
      { id: 'premium_1m', weight: 88 },
      { id: 'badge_dev', weight: 48 },
      { id: 'gift_car', weight: 18 },
      { id: 'verify_blue', weight: 6.2 },
      { id: 'premium_1y', weight: 1.7 },
      { id: 'nick_gold', weight: 0.35 },
      { id: 'channel_100k', weight: 0.05 },
    ],
  },
  {
    id: 'legend', name: 'Легендарный', emo: '👑', price: 24900,
    grad: 'linear-gradient(135deg,#FFB020,#FF6A00)',
    drops: [
      { id: 'gift_car', weight: 260 },
      { id: 'verify_blue', weight: 210 },
      { id: 'premium_1y', weight: 165 },
      { id: 'channel_1k', weight: 120 },
      { id: 'nick_gold', weight: 80 },
      { id: 'gift_yacht', weight: 42 },
      { id: 'badge_admin', weight: 17 },
      { id: 'channel_100k', weight: 5.4 },
      { id: 'gift_jet', weight: 1.6 },
      { id: 'channel_1m', weight: 0.42 },
      { id: 'verify_gold', weight: 0.1 },
      { id: 'gift_crown', weight: 0.02 },
      { id: 'max_itself', weight: 0.002 },
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
