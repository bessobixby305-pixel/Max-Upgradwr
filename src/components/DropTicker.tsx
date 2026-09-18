import { useEffect, useRef } from 'react'
import { ITEM_BY_ID, RARITY_COLOR, rarityOf } from '../core/items'
import { useGame } from '../store/game'

/** Лента последних дропов всех игроков — как бегущая строка наверху дроп-сайтов. */
export default function DropTicker() {
  const drops = useGame((s) => s.messages)
  const boxRef = useRef<HTMLDivElement>(null)

  const items = drops
    .filter((m) => m.chat === 'drops' && m.result?.itemId)
    .slice(-30)
    .reverse()

  // новый дроп приходит слева — возвращаем прокрутку в начало
  useEffect(() => {
    boxRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }, [items.length])

  const online = 1200 + (items.length * 37) % 900

  return (
    <div className="ticker" ref={boxRef}>
      <div className="ticker-online">
        <span className="n mono">{online.toLocaleString('ru-RU')}</span>
        <span className="l">онлайн</span>
      </div>
      {items.map((m) => {
        const def = ITEM_BY_ID[m.result!.itemId!]
        if (!def) return null
        return (
          <div
            key={m.id}
            className="ticker-item"
            style={{ ['--rc' as any]: RARITY_COLOR[rarityOf(def.price)] }}
            title={`${def.name} · ${m.author?.name ?? ''}`}
          >
            <span className="emo">{def.emo}</span>
            <span className="nm">{def.name}</span>
            <span className="who">{m.author?.name ?? 'Игрок'}</span>
          </div>
        )
      })}
      {!items.length && (
        <div className="ticker-item" style={{ width: 140 }}>
          <span className="nm">Пока никто ничего не выбил</span>
        </div>
      )}
    </div>
  )
}
