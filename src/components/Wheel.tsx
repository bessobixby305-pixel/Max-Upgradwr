import { useEffect, useRef, useState } from 'react'

const R = 42
const C = 2 * Math.PI * R
const TICKS = 60

/** Колесо апгрейда: кольцо с сектором шанса, насечками и стрелкой сверху. */
export default function Wheel({
  chance, mult, rotation, spinning, result, durationMs,
}: {
  chance: number
  mult: number
  rotation: number
  spinning: boolean
  result: 'win' | 'lose' | null
  durationMs: number
}) {
  const win = Math.max(0.004, Math.min(0.996, chance))
  const [flash, setFlash] = useState(false)
  const prev = useRef(result)

  useEffect(() => {
    if (result && result !== prev.current) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 900)
      prev.current = result
      return () => clearTimeout(t)
    }
    prev.current = result
  }, [result])

  const lost = result === 'lose'

  return (
    <div className="wheel-wrap">
      <div className="wheel-box">
        <svg className="wheel-arrow" viewBox="0 0 34 40" aria-hidden>
          <defs>
            <linearGradient id="arrowG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#E7EAF3" />
              <stop offset="100%" stopColor="#B9C0D0" />
            </linearGradient>
          </defs>
          <path d="M17 40 L2 11 A16.5 16.5 0 0 1 32 11 Z" fill="url(#arrowG)" stroke="rgba(10,12,20,.25)" strokeWidth="1.2" />
          <circle cx="17" cy="12" r="4.6" fill="var(--accent-1)" />
          <circle cx="17" cy="12" r="1.8" fill="rgba(255,255,255,.85)" />
        </svg>

        <svg
          className={'wheel-svg' + (flash ? ' wheel-glow' : '')}
          viewBox="0 0 100 100"
          style={{
            transform: `rotate(${-rotation}deg)`,
            transition: spinning ? `transform ${durationMs}ms cubic-bezier(.11,.68,.13,1)` : 'none',
          }}
        >
          <defs>
            <linearGradient id="winG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3FE07C" />
              <stop offset="100%" stopColor="#12A551" />
            </linearGradient>
            <linearGradient id="loseG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FF7A72" />
              <stop offset="100%" stopColor="#D02C22" />
            </linearGradient>
            <filter id="ringGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* подложка кольца */}
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg-sub)" strokeWidth="13" />
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--line)" strokeWidth="13.6" opacity=".6" />

          {/* насечки по окружности */}
          <g opacity=".3">
            {Array.from({ length: TICKS }, (_, i) => {
              const a = (i / TICKS) * 2 * Math.PI - Math.PI / 2
              const big = i % 5 === 0
              const r0 = R + (big ? 5.2 : 6)
              const r1 = R + 6.9
              return (
                <line
                  key={i}
                  x1={50 + r0 * Math.cos(a)} y1={50 + r0 * Math.sin(a)}
                  x2={50 + r1 * Math.cos(a)} y2={50 + r1 * Math.sin(a)}
                  stroke="var(--text-3)" strokeWidth={big ? 1 : 0.5} strokeLinecap="round"
                />
              )
            })}
          </g>

          {/* сектор шанса */}
          <circle
            cx="50" cy="50" r={R} fill="none"
            stroke={lost ? 'url(#loseG)' : 'url(#winG)'}
            strokeWidth="13"
            strokeDasharray={`${win * C} ${C}`}
            strokeLinecap={win > 0.025 ? 'butt' : 'round'}
            transform="rotate(-90 50 50)"
            filter={flash ? 'url(#ringGlow)' : undefined}
            style={{ transition: 'stroke-dasharray .3s ease' }}
          />
          {/* внутренняя грань для объёма */}
          <circle cx="50" cy="50" r={R - 6.5} fill="none" stroke="rgba(0,0,0,.07)" strokeWidth="1" />
          <circle cx="50" cy="50" r={R + 6.5} fill="none" stroke="rgba(0,0,0,.05)" strokeWidth="1" />
        </svg>

        <div className="wheel-center">
          <div>
            <div
              className="mult mono"
              style={{
                color: result === 'win' ? 'var(--green)' : lost ? 'var(--red)' : undefined,
                transition: 'color .3s',
              }}
            >
              x{mult.toFixed(2)}
            </div>
            <div className="chance mono">{(chance * 100).toFixed(2)}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}
