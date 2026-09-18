import { useEffect } from 'react'
import { ITEM_BY_ID, RARITY_COLOR, RARITY_NAME, rarityOf } from '../core/items'
import { fmt } from '../core/economy'

export interface WinInfo {
  /** предмет, если наградой стал он */
  itemId?: string
  /** сумма, если наградой стали MX */
  amount?: number
  label: string
}

/** Полноэкранное «ты выиграл» с лучами и подсветкой по редкости. */
export default function WinOverlay({ win, onClose }: { win: WinInfo | null; onClose: () => void }) {
  useEffect(() => {
    if (!win) return
    const t = setTimeout(onClose, 4200)
    return () => clearTimeout(t)
  }, [win, onClose])

  if (!win) return null

  const item = win.itemId ? ITEM_BY_ID[win.itemId] : undefined
  const rar = item ? rarityOf(item.price) : 'epic'
  const color = item ? RARITY_COLOR[rar] : 'var(--accent-1)'

  return (
    <div className="win-back" onClick={onClose}>
      <div className="win-card" style={{ ['--rc' as any]: color }} onClick={(e) => e.stopPropagation()}>
        <div className="win-rays" />
        <div className="win-emo">{item ? item.emo : '💠'}</div>
        <div className="win-label">{win.label}</div>
        {item ? (
          <>
            <div className="win-name">{item.name}</div>
            <div className="win-price mono">{fmt(item.price)} MX</div>
            <div className="win-rarity">{RARITY_NAME[rar]}</div>
          </>
        ) : (
          <div className="win-price mono" style={{ fontSize: 34 }}>+{fmt(win.amount ?? 0)} MX</div>
        )}
        <button className="btn" style={{ marginTop: 20 }} onClick={onClose}>
          {item ? 'Забрать в инвентарь' : 'Отлично'}
        </button>
      </div>
    </div>
  )
}
