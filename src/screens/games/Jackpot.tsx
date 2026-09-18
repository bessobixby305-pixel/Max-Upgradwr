import { useRef, useState } from 'react'
import { BalancePill, BetInput, Header } from '../../components/ui'
import { fmt } from '../../core/economy'
import { useGame } from '../../store/game'
import { confetti, haptic, sfx, wait } from '../../lib/fx'

const RAKE = 0.08
const NAMES = ['Артём_max', 'Ника228', 'Тимур_pro', 'Соня🍀', 'Денис_off', 'Влад ЪУЪ', 'Катя_чат', 'Гоша2010']
const EMOS = ['🐱', '🐼', '🦊', '🐸', '👾', '🎧', '🐝', '🍕']

interface Entry { name: string; emo: string; bet: number; me: boolean; color: string }

const COLORS = ['#7C5CFF', '#3F8CFF', '#1FB85A', '#FFB020', '#FF4FA3', '#00C2C7']

export default function Jackpot({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [bet, setBet] = useState(500)
  const [players, setPlayers] = useState(3)
  const [entries, setEntries] = useState<Entry[]>([])
  const [rolling, setRolling] = useState(false)
  const [winner, setWinner] = useState<Entry | null>(null)
  const [angle, setAngle] = useState(0)
  const hostRef = useRef<HTMLDivElement>(null)

  const maxBet = Math.max(1, Math.floor(g.balance))
  const pot = entries.reduce((s, e) => s + e.bet, 0)
  const myShare = entries.length ? (entries.find((e) => e.me)?.bet ?? 0) / pot : 0

  async function start() {
    if (rolling) return
    if (!g.bet(bet)) { g.toast('Недостаточно MX'); return }
    setWinner(null)
    setRolling(true)
    sfx.click()

    const list: Entry[] = [{ name: 'Ты', emo: '🦄', bet, me: true, color: COLORS[0] }]
    const pool = NAMES.slice().sort(() => Math.random() - 0.5)
    for (let i = 0; i < players; i++) {
      list.push({
        name: pool[i],
        emo: EMOS[(Math.random() * EMOS.length) | 0],
        bet: Math.max(10, Math.round(bet * (0.3 + Math.random() * 2.2))),
        me: false,
        color: COLORS[(i + 1) % COLORS.length],
      })
    }
    setEntries(list)
    await wait(600)

    const total = list.reduce((s, e) => s + e.bet, 0)
    const { roll } = g.nextRoll()
    let acc = 0
    let win = list[list.length - 1]
    for (const e of list) {
      acc += e.bet / total
      if (roll < acc) { win = e; break }
    }

    // крутим круг так, чтобы стрелка встала на сектор победителя
    let start = 0
    for (const e of list) {
      if (e === win) break
      start += (e.bet / total) * 360
    }
    const mid = start + ((win.bet / total) * 360) / 2
    const dur = g.settings.fastMode ? 900 : 4200
    setAngle((a) => a + 360 * 5 + (((mid - ((a % 360) + 360) % 360) + 360) % 360))

    if (!g.settings.fastMode) {
      let t = 0
      const tick = () => {
        if (t > dur) return
        sfx.tick()
        const k = t / dur
        t += 55 + k * k * 480
        setTimeout(tick, 55 + k * k * 480)
      }
      tick()
    }
    await wait(dur + 200)

    const payout = Math.round(total * (1 - RAKE))
    if (win.me) {
      g.win(payout)
      g.bumpStats({ wins: g.stats.wins + 1, jackpotWins: g.stats.jackpotWins + 1 })
      confetti(hostRef.current, 170)
      sfx.bigWin()
      haptic([0, 50, 60, 50])
    } else {
      g.bumpStats({ losses: g.stats.losses + 1 })
      sfx.lose()
      haptic(140)
    }

    setWinner(win)
    setRolling(false)
    g.logRound({ kind: 'jackpot', roll, chance: bet / total, win: win.me, payout: win.me ? payout : 0 })
    g.pushResult({
      kind: 'jackpot',
      title: `Джекпот · банк ${fmt(total)} MX`,
      bet, payout: win.me ? payout : 0,
      chance: bet / total,
      extra: win.me ? 'банк твой' : `забрал ${win.name}`,
    })
    g.checkAchievements()
  }

  // сектора круга
  let acc = 0
  const arcs = entries.map((e) => {
    const from = acc
    const size = pot ? (e.bet / pot) * 360 : 0
    acc += size
    return { e, from, size }
  })

  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header title="Джекпот" sub="банк забирает один" onBack={onBack} right={<BalancePill />} />
      <div className="screen has-action-bar">
        <div className="pad">
          <div className="wheel-wrap">
            <div className="wheel-box">
              <svg className="wheel-arrow" viewBox="0 0 34 40" aria-hidden>
                <path d="M17 40 L2 11 A16.5 16.5 0 0 1 32 11 Z" fill="#fff" stroke="rgba(10,12,20,.25)" strokeWidth="1.2" />
                <circle cx="17" cy="12" r="4.6" fill="var(--accent-1)" />
              </svg>
              <svg
                className="wheel-svg"
                viewBox="0 0 100 100"
                style={{
                  transform: `rotate(${-angle}deg)`,
                  transition: rolling ? `transform ${g.settings.fastMode ? 900 : 4200}ms cubic-bezier(.1,.7,.12,1)` : 'none',
                }}
              >
                {arcs.length ? arcs.map(({ e, from, size }, i) => {
                  const a0 = (from - 90) * (Math.PI / 180)
                  const a1 = (from + size - 90) * (Math.PI / 180)
                  const R = 44
                  const large = size > 180 ? 1 : 0
                  return (
                    <path
                      key={i}
                      d={`M50 50 L${50 + R * Math.cos(a0)} ${50 + R * Math.sin(a0)} A${R} ${R} 0 ${large} 1 ${50 + R * Math.cos(a1)} ${50 + R * Math.sin(a1)} Z`}
                      fill={e.color}
                      stroke="var(--bg)"
                      strokeWidth="0.8"
                    />
                  )
                }) : (
                  <circle cx="50" cy="50" r="44" fill="var(--bg-sub)" />
                )}
              </svg>
              <div className="wheel-center">
                <div>
                  <div className="mult mono" style={{ fontSize: 20 }}>{fmt(pot)}</div>
                  <div className="chance">в банке</div>
                </div>
              </div>
            </div>
          </div>

          {winner && (
            <div className="card center pop" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 34 }}>{winner.emo}</div>
              <b style={{ fontSize: 17 }}>{winner.me ? 'Ты забрал банк!' : `Победил ${winner.name}`}</b>
              <div className="mono" style={{ fontSize: 22, fontWeight: 900, color: winner.me ? 'var(--green)' : 'var(--red)' }}>
                {winner.me ? '+' + fmt(pot * (1 - RAKE)) : '−' + fmt(bet)} MX
              </div>
            </div>
          )}

          {entries.length > 0 && (
            <div className="list" style={{ marginBottom: 14 }}>
              {entries.map((e, i) => (
                <div className="row" key={i} style={{ opacity: winner && winner !== e ? .5 : 1 }}>
                  <span className="jp-dot" style={{ background: e.color }} />
                  <span className="avatar sm">{e.emo}</span>
                  <span style={{ flex: 1 }}>
                    <div className="t" style={{ fontSize: 14 }}>{e.name}</div>
                    <div className="s mono">{((e.bet / pot) * 100).toFixed(1)}% шанс</div>
                  </span>
                  <span className="r mono" style={{ fontWeight: 800 }}>{fmt(e.bet)}</span>
                </div>
              ))}
            </div>
          )}

          <BetInput value={bet} onChange={setBet} max={maxBet} />
          <div className="chips" style={{ marginTop: 12 }}>
            {[1, 2, 3, 5].map((p) => (
              <button key={p} className={'chip' + (players === p ? ' on' : '')} onClick={() => setPlayers(p)}>
                {p + 1} игрока
              </button>
            ))}
          </div>

          <p className="muted" style={{ fontSize: 12.5, marginTop: 14, lineHeight: 1.5 }}>
            Шанс равен доле твоей ставки в банке{entries.length ? `, сейчас ${(myShare * 100).toFixed(1)}%` : ''}.
            Комиссия банка 8%, отдача 92% при любом размере ставки.
          </p>
        </div>
      </div>

      <div className="action-bar">
        <button className="btn" disabled={rolling || bet > maxBet} onClick={start}>
          {rolling ? 'Крутится…' : `Войти в банк · ${fmt(bet)} MX`}
        </button>
      </div>
    </div>
  )
}
