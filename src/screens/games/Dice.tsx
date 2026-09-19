import { useRef, useState } from 'react'
import { BalancePill, BetInput, Header } from '../../components/ui'
import { fmt } from '../../core/economy'
import { DICE_MAX_T, DICE_MIN_T, DICE_RTP, playDice } from '../../core/games'
import { useGame } from '../../store/game'
import { playInstant } from '../../lib/round'
import { confetti, haptic, sfx, wait } from '../../lib/fx'

const RTP = DICE_RTP
const MIN_T = DICE_MIN_T
const MAX_T = DICE_MAX_T

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
    setRolling(true)
    setWon(null)
    sfx.click()

    let res
    try {
      res = await playInstant({
        kind: 'dice', bet,
        path: '/play/dice', body: { bet, target, over },
        local: (rng) => playDice(rng, { bet, target, over }),
        bump: (o) => (o.win ? { diceWins: g.stats.diceWins + 1 } : {}),
      })
    } catch (e) {
      setRolling(false)
      g.toast((e as Error).message)
      return
    }
    const v = Number(res.outcome.detail.value) // 0.00 … 99.99

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

    const win = res.outcome.win
    const got = res.outcome.payout
    if (win) {
      confetti(hostRef.current, mult >= 5 ? 130 : 60)
      mult >= 5 ? sfx.bigWin() : sfx.win()
      haptic([0, 40, 50, 40])
    } else {
      sfx.lose()
      haptic(130)
    }

    setWon(win)
    setHistory((h) => [{ v, w: win }, ...h].slice(0, 12))
    setRolling(false)
    g.pushResult({
      kind: 'dice',
      title: `Кости ${over ? '>' : '<'} ${target}`,
      bet, payout: got, chance: res.outcome.chance ?? chance, mult,
      extra: `выпало ${v.toFixed(2)}`,
    })
  }

  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header title="Кости" sub="больше или меньше · RTP 95%" onBack={onBack} right={<BalancePill />} />
      <div className="screen has-action-bar">
        <div className="pad">
          <div className="dc-stage">
            <div className={'dc-read' + (won === true ? ' win' : won === false ? ' lose' : '')}>
              <div className="dc-num mono">{value === null ? '—' : value.toFixed(2)}</div>
              <div className="dc-tag">
                {won === true ? 'победа' : won === false ? 'мимо' : rolling ? 'бросаем' : `нужно ${over ? 'больше' : 'меньше'} ${target}`}
              </div>
            </div>

            <div className="dc-track">
              <div
                className="dc-zone win"
                style={{ left: over ? `${target}%` : 0, width: over ? `${100 - target}%` : `${target}%` }}
              />
              <div className="dc-ticks">
                {[25, 50, 75].map((t) => <i key={t} style={{ left: `${t}%` }} />)}
              </div>
              {value !== null && (
                <div
                  className={'dc-hit' + (won === true ? ' win' : ' lose')}
                  style={{ left: `${Math.min(99, Math.max(1, value))}%` }}
                >
                  <b className="mono">{value.toFixed(2)}</b>
                </div>
              )}
              <div className="dc-handle" style={{ left: `${target}%` }}>
                <span className="mono">{target}</span>
              </div>
            </div>

            <div className="dc-scale mono">
              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </div>

          {history.length > 0 && (
            <div className="dc-history">
              {history.map((h, i) => (
                <span key={i} className={'dc-pill mono' + (h.w ? ' win' : '')}>{h.v.toFixed(2)}</span>
              ))}
            </div>
          )}

          <div className="dc-stats">
            <div className="stat">
              <div className="v mono">{(chance * 100).toFixed(1)}%</div>
              <div className="l">Шанс</div>
            </div>
            <div className="stat">
              <div className="v mono">x{mult.toFixed(2)}</div>
              <div className="l">Множитель</div>
            </div>
            <div className="stat">
              <div className="v mono" style={{ color: 'var(--green)' }}>+{fmt(payout)}</div>
              <div className="l">Выигрыш</div>
            </div>
          </div>

          <div className="card" style={{ margin: '14px 0' }}>
            <div className="chips" style={{ marginBottom: 14 }}>
              <button className={'chip' + (!over ? ' on' : '')} onClick={() => setOver(false)}>
                ▼ Меньше
              </button>
              <button className={'chip' + (over ? ' on' : '')} onClick={() => setOver(true)}>
                ▲ Больше
              </button>
            </div>
            <input
              type="range" min={MIN_T} max={MAX_T} step={1}
              value={target}
              onChange={(e) => setTarget(+e.target.value)}
            />
            <div className="chips" style={{ marginTop: 10 }}>
              {[10, 25, 50, 75, 90].map((t) => (
                <button key={t} className={'chip' + (target === t ? ' on' : '')} onClick={() => setTarget(t)}>{t}</button>
              ))}
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
