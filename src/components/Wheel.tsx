import { useEffect, useRef, useState } from 'react'

export interface WheelHandle { angle: number }

/** Колесо апгрейда: кольцо с зелёным сектором шанса и стрелка сверху. */
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
  const R = 44
  const C = 2 * Math.PI * R
  const win = Math.max(0.004, Math.min(0.996, chance))
  const [flash, setFlash] = useState(false)
  const prev = useRef(result)

  useEffect(() => {
    if (result && result !== prev.current) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 800)
      prev.current = result
      return () => clearTimeout(t)
    }
    prev.current = result
  }, [result])

  const sectorColor = result === 'win' ? 'var(--green)' : result === 'lose' ? 'var(--r-common)' : 'var(--green)'

  return (
    <div className="wheel-wrap">
      <div className="wheel-box">
        <div className="wheel-arrow" />
        <svg
          className={'wheel-svg' + (flash ? ' spin-glow' : '')}
          viewBox="0 0 100 100"
          style={{
            transform: `rotate(${-rotation}deg)`,
            transition: spinning
              ? `transform ${durationMs}ms cubic-bezier(.11,.68,.13,1)`
              : 'none',
          }}
        >
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg-sub)" strokeWidth="11" />
          <circle
            cx="50" cy="50" r={R} fill="none"
            stroke={sectorColor}
            strokeWidth="11"
            strokeDasharray={`${win * C} ${C}`}
            strokeLinecap={win > 0.02 ? 'butt' : 'round'}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dasharray .25s, stroke .3s' }}
          />
        </svg>
        <div className="wheel-center">
          <div>
            <div className="mult mono" style={{
              color: result === 'win' ? 'var(--green)' : result === 'lose' ? 'var(--red)' : undefined,
            }}>
              x{mult.toFixed(2)}
            </div>
            <div className="chance mono">{(chance * 100).toFixed(2)}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}
