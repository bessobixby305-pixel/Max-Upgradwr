import { useRef, useState } from 'react'
import { BalancePill, Header } from '../../components/ui'
import { WHEEL_COOLDOWN, WHEEL_SECTORS, fmt } from '../../core/economy'
import { useGame } from '../../store/game'
import { confetti, haptic, sfx, wait } from '../../lib/fx'

const COLORS = ['#4B49E5', '#3B7FC4', '#1E9E52', '#C98411', '#C7467E', '#8557CE', '#12938D', '#B8621C', '#D94437']
const TOTAL = WHEEL_SECTORS.reduce((s, x) => s + x.weight, 0)

export default function DailyWheel({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [won, setWon] = useState<number | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  const left = WHEEL_COOLDOWN - (Date.now() - g.wheelLast)
  const ready = left <= 0
  const hours = Math.ceil(left / 3600000)

  // равные по углу сектора, но разные по весу — честность в выборе, не в размере
  const seg = 360 / WHEEL_SECTORS.length

  async function spin() {
    if (!ready || spinning) return
    setSpinning(true)
    setWon(null)
    sfx.click()

    const { roll } = g.nextRoll()
    let acc = 0
    let idx = WHEEL_SECTORS.length - 1
    for (let i = 0; i < WHEEL_SECTORS.length; i++) {
      acc += WHEEL_SECTORS[i].weight / TOTAL
      if (roll < acc) { idx = i; break }
    }

    const center = idx * seg + seg / 2
    setRot((r) => r + 360 * 6 + ((center - ((r % 360) + 360) % 360) + 360) % 360)

    let t = 0
    const tick = () => {
      if (t > 4200) return
      sfx.tick()
      const k = t / 4200
      t += 50 + k * k * 460
      setTimeout(tick, 50 + k * k * 460)
    }
    tick()

    await wait(4400)
    const value = WHEEL_SECTORS[idx].value
    g.claimWheel(value)
    g.logRound({ kind: 'bonus', roll, win: true, payout: value })
    setWon(value)
    setSpinning(false)
    confetti(hostRef.current, value >= 2500 ? 150 : 70)
    value >= 2500 ? sfx.bigWin() : sfx.win()
    haptic([0, 40, 60, 40])
  }

  const R = 46
  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header title="Колесо дня" sub="бесплатный спин раз в 8 часов" onBack={onBack} right={<BalancePill />} />
      <div className="screen">
        <div className="pad">
          <div className="wheel-wrap">
            <div className="wheel-box">
              <svg className="wheel-arrow" viewBox="0 0 20 24" aria-hidden>
                <path d="M10 24 1.5 6.5a9.5 9.5 0 0 1 17 0Z" fill="var(--text)" />
              </svg>
              <svg
                className="wheel-svg"
                viewBox="0 0 100 100"
                style={{
                  transform: `rotate(${-rot}deg)`,
                  transition: spinning ? 'transform 4400ms cubic-bezier(.1,.7,.12,1)' : 'none',
                }}
              >
                {WHEEL_SECTORS.map((s, i) => {
                  const a0 = (i * seg - 90) * (Math.PI / 180)
                  const a1 = ((i + 1) * seg - 90) * (Math.PI / 180)
                  const x0 = 50 + R * Math.cos(a0), y0 = 50 + R * Math.sin(a0)
                  const x1 = 50 + R * Math.cos(a1), y1 = 50 + R * Math.sin(a1)
                  const mid = (a0 + a1) / 2
                  return (
                    <g key={i}>
                      <path
                        d={`M50 50 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z`}
                        fill={COLORS[i % COLORS.length]}
                      />
                      <text
                        x={50 + R * 0.68 * Math.cos(mid)}
                        y={50 + R * 0.68 * Math.sin(mid)}
                        fill="#fff" fontSize="6" fontWeight="800"
                        textAnchor="middle" dominantBaseline="middle"
                        transform={`rotate(${(i * seg + seg / 2)} ${50 + R * 0.68 * Math.cos(mid)} ${50 + R * 0.68 * Math.sin(mid)})`}
                      >{s.label}</text>
                    </g>
                  )
                })}
                <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg)" strokeWidth="2" />
              </svg>
              <div className="wheel-center" style={{ inset: '34%' }}>
                <div style={{ fontSize: 26 }}>🎁</div>
              </div>
            </div>
          </div>

          {won !== null && (
            <div className="card center pop" style={{ marginBottom: 14 }}>
              <div className="muted" style={{ fontSize: 13 }}>Выигрыш</div>
              <div className="mono" style={{ fontSize: 30, fontWeight: 900, color: 'var(--green)' }}>
                +{fmt(won)} MX
              </div>
            </div>
          )}

          <button className="btn" disabled={!ready || spinning} onClick={spin}>
            {spinning ? 'Крутится…' : ready ? 'Крутить бесплатно' : `Следующий спин через ~${hours} ч`}
          </button>

          <p className="muted center" style={{ fontSize: 12.5, marginTop: 14 }}>
            Шансы: 50 MX — 26%, 100 — 23%, 200 — 19%, 350 — 14%, 600 — 9%,
            1 000 — 5.5%, 2 500 — 2.5%, 10 000 — 0.8%, 50 000 — 0.2%.
          </p>
        </div>
      </div>
    </div>
  )
}
