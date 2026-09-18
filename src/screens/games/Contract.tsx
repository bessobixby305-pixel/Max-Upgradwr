import { useRef, useState } from 'react'
import { BalancePill, Header, ItemCard } from '../../components/ui'
import { ITEM_BY_ID, nearestItem } from '../../core/items'
import { fmt } from '../../core/economy'
import { useGame } from '../../store/game'
import { confetti, haptic, sfx, wait } from '../../lib/fx'

const RTP = 0.9
const MIN_ITEMS = 3
const MAX_ITEMS = 10

export default function Contract({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [sel, setSel] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  const selItems = sel.map((u) => g.inventory.find((i) => i.uid === u)).filter(Boolean)
  const sum = selItems.reduce((s, i) => s + (ITEM_BY_ID[i!.id]?.price ?? 0), 0)
  const ev = Math.round(sum * RTP)
  const ready = sel.length >= MIN_ITEMS

  const toggle = (uid: string) => {
    setResult(null)
    setSel((s) =>
      s.includes(uid) ? s.filter((x) => x !== uid) : s.length >= MAX_ITEMS ? s : [...s, uid],
    )
    sfx.click()
  }

  async function run() {
    if (!ready || busy) return
    setBusy(true)
    setResult(null)
    const { roll } = g.nextRoll()

    // треугольное распределение вокруг ожидания: чаще средне, редко — джекпот
    const u = roll
    const spread = u < 0.5
      ? 0.25 + Math.sqrt(u * 0.5) * 1.1       // 0.25 … 0.8
      : 0.8 + Math.pow((u - 0.5) * 2, 3) * 2.7 // 0.8 … 3.5
    const value = Math.max(1, Math.round(ev * spread))
    const item = nearestItem(value)

    g.removeItems(sel)
    g.bumpStats({ contracts: g.stats.contracts + 1, totalWagered: g.stats.totalWagered + sum })
    sfx.tick()
    await wait(1100)

    g.addItem(item.id)
    setResult(item.id)
    setBusy(false)
    setSel([])

    const win = item.price >= sum
    if (win) { confetti(hostRef.current, 90); sfx.win(); haptic([0, 40, 50, 40]) }
    else { sfx.lose(); haptic(120) }

    g.logRound({ kind: 'contract', roll, win, payout: item.price })
    g.pushResult({
      kind: 'contract',
      title: `Контракт из ${selItems.length} предметов`,
      bet: sum, payout: item.price, itemId: item.id,
    })
    g.checkAchievements()
  }

  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header title="Контракт" sub="3–10 предметов → один" onBack={onBack} right={<BalancePill />} />
      <div className="screen">
        <div className="pad">
          <div className="card" style={{ marginBottom: 14, textAlign: 'center' }}>
            {result ? (
              <div className="pop">
                <div style={{ fontSize: 54 }}>{ITEM_BY_ID[result].emo}</div>
                <b>{ITEM_BY_ID[result].name}</b>
                <div className="mono muted">{fmt(ITEM_BY_ID[result].price)} MX</div>
              </div>
            ) : busy ? (
              <div style={{ fontSize: 46 }} className="shake">🌀</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  <div>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>{sel.length}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>выбрано</div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>{fmt(sum)}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>сумма</div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-1)' }}>{fmt(ev)}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>ожидание</div>
                  </div>
                </div>
                <p className="muted" style={{ fontSize: 12.5, marginBottom: 0, marginTop: 10 }}>
                  Результат — от 25% до 350% от ожидания. Иногда контракт выстреливает.
                </p>
              </>
            )}
          </div>

          {!g.inventory.length ? (
            <div className="center muted" style={{ padding: '50px 20px' }}>
              <div style={{ fontSize: 44 }}>📝</div>
              Нужны предметы. Открой кейс или выиграй апгрейд.
            </div>
          ) : (
            <div className="grid">
              {g.inventory.map((i) => (
                <ItemCard key={i.uid} id={i.id} selected={sel.includes(i.uid)} onClick={() => toggle(i.uid)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {g.inventory.length > 0 && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '10px 16px calc(12px + var(--safe-bottom))',
          background: 'var(--bg)', borderTop: '1px solid var(--sep)',
          maxWidth: 560, margin: '0 auto',
        }}>
          <button className="btn" disabled={!ready || busy} onClick={run}>
            {busy ? 'Плавим…' : ready ? `Заключить контракт · ${fmt(sum)} MX` : `Выбери ещё ${MIN_ITEMS - sel.length}`}
          </button>
        </div>
      )}
    </div>
  )
}
