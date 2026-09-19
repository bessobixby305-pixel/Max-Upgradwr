import { useRef, useState } from 'react'
import { BalancePill, Header, ItemCard } from '../../components/ui'
import { ITEM_BY_ID } from '../../core/items'
import { fmt } from '../../core/economy'
import { CONTRACT_MAX, CONTRACT_MIN, CONTRACT_RTP, playContract } from '../../core/games'
import { useGame } from '../../store/game'
import { playInstant } from '../../lib/round'
import { confetti, haptic, sfx, wait } from '../../lib/fx'

const RTP = CONTRACT_RTP
const MIN_ITEMS = CONTRACT_MIN
const MAX_ITEMS = CONTRACT_MAX

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
    const prices = selItems.map((i) => ITEM_BY_ID[i!.id]?.price ?? 0)
    const burned = selItems.length

    let res
    try {
      res = await playInstant({
        kind: 'contract', bet: 0,
        path: '/play/contract', body: { uids: sel },
        local: (rng) => {
          // офлайн ставку составляют сами предметы — сжигаем их здесь
          g.removeItems(sel)
          g.bumpStats({ contracts: g.stats.contracts + 1, totalWagered: g.stats.totalWagered + sum })
          return playContract(rng, prices)
        },
      })
    } catch (e) {
      setBusy(false)
      g.toast((e as Error).message)
      return
    }
    // на сервере предметы сгорели там — убираем их и у себя
    g.removeItems(sel)

    const item = ITEM_BY_ID[res.outcome.itemId!]
    sfx.tick()
    await wait(1100)

    setResult(item?.id ?? null)
    setBusy(false)
    setSel([])

    if (res.outcome.win) { confetti(hostRef.current, 90); sfx.win(); haptic([0, 40, 50, 40]) }
    else { sfx.lose(); haptic(120) }

    g.pushResult({
      kind: 'contract',
      title: `Контракт из ${burned} предметов`,
      bet: sum, payout: item?.price ?? 0, itemId: item?.id,
    })
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
                    <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{fmt(ev)}</div>
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
