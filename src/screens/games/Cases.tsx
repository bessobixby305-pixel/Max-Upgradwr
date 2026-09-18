import { useRef, useState } from 'react'
import { BalancePill, Header, Sheet } from '../../components/ui'
import WinOverlay, { WinInfo } from '../../components/WinOverlay'
import { CASES, CaseDef, caseRtp, dropChance, pickDrop } from '../../core/cases'
import { ITEM_BY_ID, ItemDef, RARITY_COLOR, rarityOf } from '../../core/items'
import { fmt } from '../../core/economy'
import Icon from '../../components/Icon'
import { tintVars } from '../Games'
import { useGame } from '../../store/game'
import { confetti, haptic, sfx, wait } from '../../lib/fx'

const ITEM_W = 104 // ширина карточки + gap
const WIN_INDEX = 48
const STRIP = 62
const ROLL_MS = 4200
const FAST_MS = 700

export default function Cases({ onBack, asTab }: { onBack: () => void; asTab?: boolean }) {
  const g = useGame()
  const [active, setActive] = useState<CaseDef | null>(null)
  const [count, setCount] = useState(1)
  const [strips, setStrips] = useState<ItemDef[][]>([])
  const [offset, setOffset] = useState(0)
  const [rolling, setRolling] = useState(false)
  const [won, setWon] = useState<ItemDef[] | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [winInfo, setWinInfo] = useState<WinInfo | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const price = active ? active.price * count : 0
  const fast = g.settings.fastMode

  async function open() {
    if (!active || rolling) return
    if (!g.bet(price)) { g.toast('Недостаточно MX'); return }
    setWon(null)
    setRolling(true)
    sfx.click()

    const results: ItemDef[] = []
    const newStrips: ItemDef[][] = []
    for (let k = 0; k < count; k++) {
      const { roll } = g.nextRoll(k)
      const item = pickDrop(active, roll)
      results.push(item)
      const strip: ItemDef[] = []
      for (let i = 0; i < STRIP; i++) {
        strip.push(i === WIN_INDEX ? item : pickDrop(active, Math.random()))
      }
      newStrips.push(strip)
      g.logRound({
        kind: 'case', roll, chance: dropChance(active, item.id),
        win: item.price >= active.price, payout: item.price,
      })
    }

    setStrips(newStrips)
    setOffset(0)
    await wait(30)

    const w = boxRef.current?.clientWidth ?? 320
    const jitter = (Math.random() - 0.5) * (ITEM_W - 26)
    setOffset(-(WIN_INDEX * ITEM_W) + w / 2 - (ITEM_W - 8) / 2 + jitter)

    const dur = fast ? FAST_MS : ROLL_MS
    if (!fast) {
      let t = 0
      const tick = () => {
        if (t > dur) return
        sfx.tick()
        const k = t / dur
        t += 55 + k * k * 500
        setTimeout(tick, 55 + k * k * 500)
      }
      tick()
    }
    await wait(dur + 150)

    // Награда за кейс — сам предмет; деньги за него даёт продажа в инвентаре.
    let total = 0
    for (const item of results) {
      g.addItem(item.id)
      total += item.price
    }
    g.recordWin(total)
    g.bumpStats({ casesOpened: g.stats.casesOpened + count })
    g.pushResult({
      kind: 'case',
      title: `Кейс «${active.name}»${count > 1 ? ` ×${count}` : ''}`,
      bet: price, payout: total,
      itemId: results.reduce((a, b) => (a.price > b.price ? a : b)).id,
    })

    const bestItem = results.reduce((a, b) => (a.price > b.price ? a : b))
    const best = bestItem.price
    // показываем крупный оверлей, когда дроп заметно дороже кейса
    if (best >= active.price * 3) {
      setWinInfo({ itemId: bestItem.id, label: `Кейс «${active.name}»` })
    }
    if (total > price) {
      confetti(hostRef.current, best > price * 8 ? 140 : 70)
      best > price * 8 ? sfx.bigWin() : sfx.win()
      haptic([0, 40, 60, 40])
    } else {
      sfx.lose(); haptic(120)
    }

    setWon(results)
    setRolling(false)
    g.checkAchievements()
  }

  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header
        title={active ? active.name : 'Кейсы'}
        sub={active ? `RTP ${(caseRtp(active) * 100).toFixed(0)}%` : 'открывай и собирай'}
        onBack={asTab && !active ? undefined : () => (active ? setActive(null) : onBack())}
        right={
          <>
            {active && (
              <button className="icon-btn" onClick={() => setInfoOpen(true)} aria-label="Шансы">
                <Icon name="info" size={21} />
              </button>
            )}
            <BalancePill />
          </>
        }
      />
      <div className={"screen" + (active ? " has-action-bar" : "")}>
        <div className="pad">
          {!active ? (
            <div className="grid2">
              {CASES.map((c) => (
                <button
                  key={c.id}
                  className="gcard"
                  style={tintVars(c.tint)}
                  onClick={() => { setActive(c); sfx.click() }}
                >
                  <span className="gico">{c.emo}</span>
                  <span className="gt">{c.name}</span>
                  <span className="gs mono">{fmt(c.price)} MX</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="roller" ref={boxRef}>
                <div className="roller-mark" />
                <div
                  className="roller-track"
                  style={{
                    transform: `translateX(${offset}px)`,
                    transition: rolling ? `transform ${fast ? FAST_MS : ROLL_MS}ms cubic-bezier(.08,.72,.11,1)` : 'none',
                  }}
                >
                  {(strips[0] ?? []).map((it, i) => (
                    <div
                      key={i}
                      className="roller-item"
                      style={{ ['--rc' as any]: RARITY_COLOR[rarityOf(it.price)] }}
                    >
                      <span className="emo">{it.emo}</span>
                      <span className="nm">{it.name}</span>
                    </div>
                  ))}
                  {!strips.length && (
                    <div className="center muted" style={{ width: '100%', padding: 44 }}>
                      {active.emo} Нажми «Открыть»
                    </div>
                  )}
                </div>
              </div>

              {won && (
                <div className="card pop" style={{ marginBottom: 12 }}>
                  <div className="center" style={{ fontWeight: 800, marginBottom: 10 }}>
                    {won.reduce((s, w) => s + w.price, 0) >= price ? '🎉 Выпало' : 'Выпало'}
                  </div>
                  <div
                    className={won.length >= 3 ? 'grid' : ''}
                    style={won.length < 3
                      ? { display: 'flex', justifyContent: 'center', gap: 10 }
                      : undefined}
                  >
                    {won.map((w, i) => (
                      <div
                        key={i}
                        className={'item ' + rarityOf(w.price)}
                        style={{
                          ['--rc' as any]: RARITY_COLOR[rarityOf(w.price)],
                          minWidth: won.length < 3 ? 124 : undefined,
                        }}
                      >
                        <div className="emo">{w.emo}</div>
                        <div className="nm">{w.name}</div>
                        <div className="px mono">{fmt(w.price)}</div>
                        <span className="rbar" />
                      </div>
                    ))}
                  </div>
                  <div className="center mono" style={{ marginTop: 10, fontWeight: 800 }}>
                    <span className={won.reduce((s, w) => s + w.price, 0) >= price ? 'win' : 'lose'}>
                      {fmt(won.reduce((s, w) => s + w.price, 0))} MX за {fmt(price)} MX
                    </span>
                  </div>
                </div>
              )}

              <div className="chips" style={{ marginBottom: 12 }}>
                {[1, 2, 3, 5].map((n) => (
                  <button key={n} className={'chip' + (count === n ? ' on' : '')} onClick={() => setCount(n)}>×{n}</button>
                ))}
                <button
                  className={'chip' + (fast ? ' on' : '')}
                  onClick={() => g.setSettings({ fastMode: !fast })}
                >⚡ Быстро</button>
              </div>

            </>
          )}
        </div>
      </div>

      {active && (
        <div className="action-bar">
          <button className="btn" disabled={rolling || g.balance < price} onClick={open}>
            {rolling ? 'Открываем…' : `Открыть за ${fmt(price)} MX`}
          </button>
        </div>
      )}

      <WinOverlay win={winInfo} onClose={() => setWinInfo(null)} />

      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} title={active ? `Шансы · ${active.name}` : ''}>
        {active && (
          <div className="list">
            {active.drops
              .slice()
              .sort((a, b) => ITEM_BY_ID[b.id].price - ITEM_BY_ID[a.id].price)
              .map((d) => {
                const it = ITEM_BY_ID[d.id]
                const ch = dropChance(active, d.id) * 100
                return (
                  <div className="row" key={d.id}>
                    <span style={{ fontSize: 22 }}>{it.emo}</span>
                    <span style={{ flex: 1 }}>
                      <div className="t" style={{ fontSize: 13.5 }}>{it.name}</div>
                      <div className="s mono">{fmt(it.price)} MX</div>
                    </span>
                    <span className="r mono" style={{ color: RARITY_COLOR[rarityOf(it.price)] }}>
                      {ch >= 1 ? ch.toFixed(2) : ch.toFixed(4)}%
                    </span>
                  </div>
                )
              })}
          </div>
        )}
      </Sheet>
    </div>
  )
}
