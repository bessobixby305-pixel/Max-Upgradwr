export interface SlotSym { id: string; emo: string; weight: number; pay3: number }

/** Три независимых барабана с одинаковым набором символов. */
export const SLOT_SYMS: SlotSym[] = [
  { id: 'cherry', emo: '🍒', weight: 30, pay3: 6 },
  { id: 'lemon', emo: '🍋', weight: 25, pay3: 10 },
  { id: 'bell', emo: '🔔', weight: 18, pay3: 20 },
  { id: 'star', emo: '⭐', weight: 12, pay3: 45 },
  { id: 'gem', emo: '💎', weight: 8, pay3: 110 },
  { id: 'seven', emo: '7️⃣', weight: 5, pay3: 350 },
  { id: 'unicorn', emo: '🦄', weight: 2, pay3: 2000 },
]

/** Выплата за две одинаковые из трёх. Подобрана под RTP ≈ 92%. */
export const PAY2 = 0.62

const TOTAL = SLOT_SYMS.reduce((s, x) => s + x.weight, 0)

/** Символ барабана по числу roll ∈ [0,1). */
export function pickSym(roll: number): SlotSym {
  let acc = 0
  const t = roll * TOTAL
  for (const s of SLOT_SYMS) {
    acc += s.weight
    if (t < acc) return s
  }
  return SLOT_SYMS[SLOT_SYMS.length - 1]
}

/** Множитель выплаты за комбинацию. */
export function slotPayout(r: SlotSym[]): { mult: number; kind: 'jackpot' | 'three' | 'two' | 'none' } {
  if (r[0].id === r[1].id && r[1].id === r[2].id) {
    return { mult: r[0].pay3, kind: r[0].id === 'unicorn' ? 'jackpot' : 'three' }
  }
  if (r[0].id === r[1].id || r[1].id === r[2].id || r[0].id === r[2].id) {
    return { mult: PAY2, kind: 'two' }
  }
  return { mult: 0, kind: 'none' }
}

/** Точный RTP набора — считается перебором всех комбинаций. */
export function slotsRtp(): number {
  let ev = 0
  for (const a of SLOT_SYMS) {
    for (const b of SLOT_SYMS) {
      for (const c of SLOT_SYMS) {
        const p = (a.weight / TOTAL) * (b.weight / TOTAL) * (c.weight / TOTAL)
        ev += p * slotPayout([a, b, c]).mult
      }
    }
  }
  return ev
}
