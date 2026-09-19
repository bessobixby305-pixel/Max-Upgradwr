import { useRef, useState } from 'react'
import { BalancePill, Header } from '../../components/ui'
import { CASES, CaseDef, pickDrop } from '../../core/cases'
import { ItemDef, RARITY_COLOR, rarityOf } from '../../core/items'
import { fmt } from '../../core/economy'
import { useGame } from '../../store/game'
import { onlineMode } from '../../lib/round'
import { confetti, haptic, sfx, wait } from '../../lib/fx'

const BOT_NAMES = ['Артём_max', 'Ника228', 'Тимур_pro', 'Соня🍀', 'Денис_off', 'Влад ЪУЪ']

interface Player { name: string; emo: string; bot: boolean; items: ItemDef[]; total: number }

export default function Battle({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [caseDef, setCaseDef] = useState<CaseDef>(CASES[1])
  const [rounds, setRounds] = useState(3)
  const [bots, setBots] = useState(1)
  const [players, setPlayers] = useState<Player[]>([])
  const [busy, setBusy] = useState(false)
  const [winner, setWinner] = useState<number | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  const cost = caseDef.price * rounds
  const pot = cost * (bots + 1)

  async function start() {
    if (busy) return
    // экономика живёт на сервере, а эти два режима туда ещё не переехали —
    // считать их локально значит рисовать себе деньги, которых нет
    if (onlineMode()) {
      g.toast('С аккаунтом этот режим пока недоступен: переносим на сервер')
      return
    }
    if (!g.bet(cost)) { g.toast('Недостаточно MX'); return }
    setWinner(null)
    setBusy(true)
    sfx.click()

    const list: Player[] = [
      { name: 'Ты', emo: '🦄', bot: false, items: [], total: 0 },
      ...BOT_NAMES.slice(0, bots).map((n) => ({
        name: n, emo: ['🐱', '🐼', '🦊', '🐸', '👾', '🎧'][(Math.random() * 6) | 0],
        bot: true, items: [] as ItemDef[], total: 0,
      })),
    ]
    setPlayers(list)

    for (let r = 0; r < rounds; r++) {
      await wait(g.settings.fastMode ? 220 : 850)
      const next = list.map((p, pi) => {
        const roll = p.bot ? Math.random() : g.nextRoll(r * 10 + pi).roll
        const item = pickDrop(caseDef, roll)
        const items = [...p.items, item]
        return { ...p, items, total: items.reduce((s, i) => s + i.price, 0) }
      })
      list.length = 0
      list.push(...next)
      setPlayers(next)
      sfx.tick()
    }

    await wait(400)
    let best = 0
    list.forEach((p, i) => { if (p.total > list[best].total) best = i })
    setWinner(best)

    if (best === 0) {
      // Победитель забирает предметы всех участников — это и есть банк.
      let taken = 0
      for (const p of list) {
        for (const it of p.items) { g.addItem(it.id); taken += it.price }
      }
      g.recordWin(taken)
      g.bumpStats({ battlesWon: g.stats.battlesWon + 1, wins: g.stats.wins + 1 })
      confetti(hostRef.current, 130)
      sfx.bigWin()
      haptic([0, 50, 60, 50])
    } else {
      g.bumpStats({ losses: g.stats.losses + 1 })
      sfx.lose()
      haptic(140)
    }
    g.bumpStats({ casesOpened: g.stats.casesOpened + rounds })
    g.pushResult({
      kind: 'battle',
      title: `Битва · ${caseDef.name} ×${rounds}`,
      bet: cost,
      payout: best === 0 ? list.reduce((sum, p) => sum + p.total, 0) : 0,
      extra: best === 0 ? 'забрал все предметы' : `победил ${list[best].name}`,
    })
    setBusy(false)
    g.checkAchievements()
  }

  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header title="Битва кейсов" sub={`в банке ${fmt(pot)} MX предметами`} onBack={onBack} right={<BalancePill />} />
      <div className="screen">
        <div className="pad">
          {players.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {players.map((p, i) => (
                <div
                  key={i}
                  className="card"
                  style={{
                    marginBottom: 8, padding: 12,
                    outline: winner === i ? '2px solid var(--green)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                    <div className="avatar sm">{p.emo}</div>
                    <b style={{ fontSize: 14 }}>{p.name}</b>
                    {winner === i && <span style={{ fontSize: 16 }}>🏆</span>}
                    <span className="mono" style={{ marginLeft: 'auto', fontWeight: 800 }}>{fmt(p.total)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {p.items.map((it, k) => (
                      <span
                        key={k}
                        className="pop"
                        style={{
                          fontSize: 22, width: 38, height: 38, display: 'grid', placeItems: 'center',
                          borderRadius: 10, background: 'var(--bg-sub)',
                          borderBottom: `3px solid ${RARITY_COLOR[rarityOf(it.price)]}`,
                        }}
                        title={it.name}
                      >{it.emo}</span>
                    ))}
                    {[...Array(Math.max(0, rounds - p.items.length))].map((_, k) => (
                      <span key={'e' + k} style={{
                        width: 38, height: 38, borderRadius: 10, background: 'var(--bg-sub)', opacity: .4,
                      }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="sec-title">Кейс</div>
          <div className="chips">
            {CASES.map((c) => (
              <button
                key={c.id}
                className={'chip' + (caseDef.id === c.id ? ' on' : '')}
                onClick={() => setCaseDef(c)}
              >{c.emo} {c.name}</button>
            ))}
          </div>

          <div className="sec-title">Раундов</div>
          <div className="chips">
            {[1, 2, 3, 5, 10].map((r) => (
              <button key={r} className={'chip' + (rounds === r ? ' on' : '')} onClick={() => setRounds(r)}>×{r}</button>
            ))}
          </div>

          <div className="sec-title">Противников</div>
          <div className="chips">
            {[1, 2, 3].map((b) => (
              <button key={b} className={'chip' + (bots === b ? ' on' : '')} onClick={() => setBots(b)}>{b}</button>
            ))}
          </div>

          <button className="btn" style={{ marginTop: 18 }} disabled={busy || g.balance < cost} onClick={start}>
            {busy ? 'Битва идёт…' : `В бой · ${fmt(cost)} MX`}
          </button>
          <p className="muted center" style={{ fontSize: 12.5, marginTop: 10 }}>
            Победитель забирает все выпавшие предметы — свои и соперников.
          </p>
        </div>
      </div>
    </div>
  )
}
