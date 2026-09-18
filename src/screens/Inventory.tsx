import { useMemo, useState } from 'react'
import { BalancePill, Header, ItemCard, Sheet } from '../components/ui'
import { RARITY_NAME, ITEM_BY_ID, rarityOf } from '../core/items'
import { SELL_RATE, fmt } from '../core/economy'
import { useGame } from '../store/game'
import { sfx } from '../lib/fx'

type Sort = 'new' | 'price' | 'name'

export default function Inventory() {
  const inv = useGame((s) => s.inventory)
  const sellItem = useGame((s) => s.sellItem)
  const sellAll = useGame((s) => s.sellAll)
  const pushText = useGame((s) => s.pushText)
  const toast = useGame((s) => s.toast)
  const [sort, setSort] = useState<Sort>('new')
  const [sel, setSel] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const a = inv.slice()
    if (sort === 'price') a.sort((x, y) => (ITEM_BY_ID[y.id]?.price ?? 0) - (ITEM_BY_ID[x.id]?.price ?? 0))
    if (sort === 'name') a.sort((x, y) => (ITEM_BY_ID[x.id]?.name ?? '').localeCompare(ITEM_BY_ID[y.id]?.name ?? ''))
    return a
  }, [inv, sort])

  const total = inv.reduce((s, i) => s + (ITEM_BY_ID[i.id]?.price ?? 0), 0)
  const selItem = sel ? inv.find((i) => i.uid === sel) : null
  const selDef = selItem ? ITEM_BY_ID[selItem.id] : null

  return (
    <>
      <Header title="Инвентарь" sub={`${inv.length} шт. · ${fmt(total)} MX`} right={<BalancePill />} />
      <div className="screen">
        <div className="pad">
          <div className="chips" style={{ marginBottom: 12 }}>
            {([['new', 'Новые'], ['price', 'Дорогие'], ['name', 'По имени']] as [Sort, string][]).map(([k, l]) => (
              <button key={k} className={'chip' + (sort === k ? ' on' : '')} onClick={() => setSort(k)}>{l}</button>
            ))}
            {inv.length > 0 && (
              <button
                className="chip"
                style={{ marginLeft: 'auto', color: 'var(--red)' }}
                onClick={() => { sellAll(); sfx.coin() }}
              >Продать всё</button>
            )}
          </div>

          {!inv.length ? (
            <div className="center muted" style={{ padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>🎒</div>
              Инвентарь пуст.<br />Открой кейс или выиграй апгрейд.
            </div>
          ) : (
            <div className="grid">
              {sorted.map((i) => (
                <ItemCard key={i.uid} id={i.id} onClick={() => { setSel(i.uid); sfx.click() }} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={!!selDef} onClose={() => setSel(null)}>
        {selDef && selItem && (
          <div className="center">
            <div style={{ fontSize: 64 }}>{selDef.emo}</div>
            <div style={{ fontSize: 19, fontWeight: 800, marginTop: 6 }}>{selDef.name}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              {RARITY_NAME[rarityOf(selDef.price)]} · {fmt(selDef.price)} MX
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                className="btn ghost"
                onClick={() => {
                  pushText(`Отправил в чат: ${selDef.emo} ${selDef.name}`, true)
                  toast('Отправлено в чат с ботом')
                  setSel(null)
                }}
              >Отправить в чат</button>
              <button
                className="btn"
                onClick={() => { sellItem(selItem.uid); sfx.coin(); setSel(null) }}
              >Продать {fmt(selDef.price * SELL_RATE)}</button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}
