import { useRef, useState } from 'react'
import { BalancePill, BetInput, Header } from '../../components/ui'
import { fmt } from '../../core/economy'
import { useGame } from '../../store/game'
import { confetti, haptic, sfx, wait } from '../../lib/fx'

const RTP = 0.95
const MIN_T = 2
const MAX_T = 98

export default function Dice({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [bet, setBet] = useState(100)
  const [target, setTarget] = useState(50)
  const [over, setOver] = useState(true)
  const [value, setValue] = useState<number | null>(null)
  const [rolling, setRolling] = useState(false)
  const [won, setWon] = useState<boolean | null>(null)
  const [history, setHistory] = useState<{ v: number; w: boolean }[]>([])
  const hostRef = useRef<HTMLDivElement>(null)

  const maxBet = Math.max(1, Math.floor(g.balance))
  const chance = (over ? 100 - target : target) / 100
  const mult = RTP / chance
  const payout = Math.round(bet * mult)

  async function roll() {
    if (rolling) return
    if (!g.bet(bet)) { g.toast('Недостаточно MX'); return }
    setRolling(true)
    setWon(null)
    sfx.click()

    const { roll: r } = g.nextRoll()
    const v = Math.floor(r * 10000) / 100 // 0.00 … 99.99

    // анимация «прокрутки» числа
    const dur = g.settings.fastMode ? 350 : 1100
    const t0 = performance.now()
    await new Promise<void>((done) => {
      const step = () => {
        const k = (performance.now() - t0) / dur
        if (k >= 1) { setValue(v); done(); return }
        setValue(Math.floor(Math.random() * 10000) / 100)
        sfx.tick()
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
    await wait(120)

    const win = over ? v > target : v < target
    const got = win ? payout : 0
    if (win) {
      g.win(got)
      g.bumpStats({ wins: g.stats.wins + 1, diceWins: g.stats.diceWins + 1 })
      confetti(hostRef.current, mult >= 5 ? 130 : 60)
      mult >= 5 ? sfx.bigWin() : sfx.win()
      haptic([0, 40, 50, 40])
    } else {
      g.bumpStats({ losses: g.stats.losses + 1 })
      sfx.lose()
      haptic(130)
    }

    setWon(win)
    setHistory((h) => [{ v, w: win }, ...h].slice(0, 12))
    setRolling(false)
    g.logRound({ kind: 'dice', roll: r, chance, win, payout: got })
    g.pushResult({
      kind: 'dice',
      title: `Кости ${over ? '>' : '<'} ${target}`,
      bet, payout: got, chance, mult,
      extra: `выпало ${v.toFixed(2)}`,
    })
    g.checkAchievements()
  }

  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header title="Кости" sub="больше или меньше · RTP 95%" onBack={onBack} right={<BalancePill />} />
      <div className="screen has-action-bar">
        <div className="pad">
          <div className="dice-box">
            <div
              className={'dice-val mono' + (won === true ? ' win' : won === false ? ' lose' : '')}
            >
              {value === null ? '—' : value.toFixed(2)}
            </div>
            <div className="dice-track">
              <div
                className="dice-fill"
                style={{
                  left: over ? `${target}%` : 0,
                  width: over ? `${100 - target}%` : `${target}%`,
                }}
              />
              <div className="dice-handle" style={{ left: `${target}%` }} />
              {value !== null && (
                <div className="dice-hit" style={{ left: `${Math.min(99.5, value)}%` }} />
              )}
            </div>
            <div className="dice-scale mono">
              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </div>

          {history.length > 0 && (
            <div className="chips" style={{ margin: '12px 0' }}>
              {history.map((h, i) => (
                <span
                  key={i}
                  className="chip mono"
                  style={{
                    padding: '5px 10px', fontSize: 12,
                    color: h.w ? 'var(--green)' : 'var(--red)',
                  }}
                >{h.v.toFixed(2)}</span>
              ))}
            </div>
          )}

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="chips" style={{ marginBottom: 12 }}>
              <button className={'chip' + (!over ? ' on' : '')} onClick={() => setOver(false)}>
                Меньше {target}
              </button>
              <button className={'chip' + (over ? ' on' : '')} onClick={() => setOver(true)}>
                Больше {target}
              </button>
            </div>
            <input
              type="range" min={MIN_T} max={MAX_T} step={1}
              value={target}
              onChange={(e) => setTarget(+e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span className="muted">Шанс</span>
              <b className="mono">{(chance * 100).toFixed(2)}%</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span className="muted">Множитель</span>
              <b className="mono">x{mult.toFixed(3)}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span className="muted">Выигрыш</span>
              <b className="mono" style={{ color: 'var(--green)' }}>+{fmt(payout)} MX</b>
            </div>
          </div>

          <BetInput value={bet} onChange={setBet} max={maxBet} />
        </div>
      </div>

      <div className="action-bar">
        <button className="btn" disabled={rolling || bet > maxBet} onClick={roll}>
          {rolling ? 'Бросаем…' : `Бросить · ${fmt(bet)} MX`}
        </button>
      </div>
    </div>
  )
}
