import { useEffect, useRef, useState } from 'react'
import { BalancePill, BetInput, Header } from '../../components/ui'
import { fmt } from '../../core/economy'
import { useGame } from '../../store/game'
import { confetti, haptic, sfx } from '../../lib/fx'

const HOUSE_EDGE = 0.05

/** Точка краша из честного числа: тяжёлый хвост, RTP ≈ 95%. */
function crashPoint(roll: number) {
  if (roll < HOUSE_EDGE) return 1
  const c = (1 - HOUSE_EDGE) / (1 - roll)
  return Math.max(1, Math.floor(c * 100) / 100)
}

export default function Crash({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [bet, setBet] = useState(100)
  const [autoAt, setAutoAt] = useState(2)
  const [mult, setMult] = useState(1)
  const [state, setState] = useState<'idle' | 'fly' | 'crashed' | 'cashed'>('idle')
  const [history, setHistory] = useState<number[]>([])
  const [points, setPoints] = useState<string>('')
  const target = useRef(0)
  const raf = useRef(0)
  const startT = useRef(0)
  const cashed = useRef(false)
  const hostRef = useRef<HTMLDivElement>(null)

  const maxBet = Math.max(1, Math.floor(g.balance))

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  function start() {
    if (state === 'fly') return
    if (!g.bet(bet)) { g.toast('Недостаточно MX'); return }
    const { roll } = g.nextRoll()
    target.current = crashPoint(roll)
    cashed.current = false
    setMult(1)
    setPoints('')
    setState('fly')
    startT.current = performance.now()
    sfx.click()
    g.logRound({ kind: 'crash', roll, win: false, payout: 0 })
    tick()
  }

  function tick() {
    raf.current = requestAnimationFrame(() => {
      const t = (performance.now() - startT.current) / 1000
      const m = Math.pow(Math.E, 0.11 * t * (1 + t * 0.08))
      const cur = Math.max(1, Math.floor(m * 100) / 100)

      if (!cashed.current && autoAt > 1 && cur >= autoAt && autoAt <= target.current) {
        setMult(autoAt)
        cashOut(autoAt)
        return
      }

      if (cur >= target.current) {
        setMult(target.current)
        boom()
        return
      }

      setMult(cur)
      // траектория графика
      const W = 100, H = 100
      const pts: string[] = []
      const steps = 34
      for (let i = 0; i <= steps; i++) {
        const tt = (t * i) / steps
        const mm = Math.pow(Math.E, 0.11 * tt * (1 + tt * 0.08))
        const x = (i / steps) * W
        const y = H - Math.min(H - 4, ((mm - 1) / Math.max(0.6, cur - 1 + 0.6)) * (H - 10))
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
      }
      setPoints(pts.join(' '))
      if (((t * 10) | 0) % 2 === 0) sfx.tick()
      tick()
    })
  }

  function cashOut(at?: number) {
    if (state !== 'fly' || cashed.current) return
    cashed.current = true
    cancelAnimationFrame(raf.current)
    const m = at ?? mult
    const payout = Math.round(bet * m)
    g.win(payout)
    setState('cashed')
    setHistory((h) => [target.current, ...h].slice(0, 12))
    confetti(hostRef.current, m >= 5 ? 120 : 60)
    m >= 5 ? sfx.bigWin() : sfx.win()
    haptic([0, 40, 50, 40])
    g.bumpStats({
      wins: g.stats.wins + 1,
      crashCashouts: g.stats.crashCashouts + 1,
      bestCrash: Math.max(g.stats.bestCrash, m),
    })
    g.pushResult({ kind: 'crash', title: `Краш x${m.toFixed(2)}`, bet, payout, mult: m })
    g.checkAchievements()
  }

  function boom() {
    cancelAnimationFrame(raf.current)
    setState('crashed')
    setHistory((h) => [target.current, ...h].slice(0, 12))
    sfx.boom()
    haptic([0, 100, 60, 160])
    g.bumpStats({ losses: g.stats.losses + 1 })
    g.pushResult({
      kind: 'crash', title: `Краш x${target.current.toFixed(2)}`, bet, payout: 0,
      extra: 'не успел забрать',
    })
    g.checkAchievements()
  }

  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header title="Краш" sub="забери до взрыва" onBack={onBack} right={<BalancePill />} />
      <div className="screen">
        <div className="pad">
          <div className="crash-box" style={{ marginBottom: 12 }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="crashFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={state === 'crashed' ? 'var(--red)' : 'var(--accent-1)'} stopOpacity="0.45" />
                  <stop offset="100%" stopColor={state === 'crashed' ? 'var(--red)' : 'var(--accent-1)'} stopOpacity="0" />
                </linearGradient>
              </defs>
              {points && <polygon points={`0,100 ${points} 100,100`} fill="url(#crashFill)" />}
              <polyline
                points={points}
                fill="none"
                stroke={state === 'crashed' ? 'var(--red)' : 'var(--accent-1)'}
                strokeWidth="2.2"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className={'crash-val mono' + (state === 'crashed' ? ' crashed' : '')}>
              {state === 'crashed' ? `💥 x${target.current.toFixed(2)}` : `x${mult.toFixed(2)}`}
            </div>
          </div>

          {history.length > 0 && (
            <div className="chips" style={{ marginBottom: 12 }}>
              {history.map((h, i) => (
                <span
                  key={i}
                  className="chip mono"
                  style={{ color: h >= 2 ? 'var(--green)' : 'var(--red)', padding: '5px 10px', fontSize: 12 }}
                >x{h.toFixed(2)}</span>
              ))}
            </div>
          )}

          {state === 'fly' ? (
            <button className="btn" onClick={() => cashOut()}>
              Забрать {fmt(Math.round(bet * mult))} MX
            </button>
          ) : (
            <>
              <BetInput value={bet} onChange={setBet} max={maxBet} />
              <div style={{ margin: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span className="muted">Автовывод</span>
                  <b className="mono">{autoAt > 1 ? `x${autoAt.toFixed(2)}` : 'выкл'}</b>
                </div>
                <input
                  type="range" min={1} max={20} step={0.05}
                  value={autoAt}
                  onChange={(e) => setAutoAt(+e.target.value)}
                />
              </div>
              <button className="btn" disabled={bet > maxBet} onClick={start}>
                Старт · {fmt(bet)} MX
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
