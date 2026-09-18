const R = 42
const C = 2 * Math.PI * R

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
  const lost = result === 'lose'

  return (
    <div className="wheel-wrap">
      <div className="wheel-box">
        <svg className="wheel-arrow" viewBox="0 0 20 24" aria-hidden>
          <path d="M10 24 1.5 6.5a9.5 9.5 0 0 1 17 0Z" fill="var(--text)" />
        </svg>

        <svg
          className="wheel-svg"
          viewBox="0 0 100 100"
          style={{
            transform: `rotate(${-rotation}deg)`,
            transition: spinning ? `transform ${durationMs}ms cubic-bezier(.11,.68,.13,1)` : 'none',
          }}
        >
          {/* подложка кольца */}
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg-sub)" strokeWidth="12" />

          {/* сектор шанса */}
          <circle
            cx="50" cy="50" r={R} fill="none"
            stroke={lost ? 'var(--red)' : 'var(--green)'}
            strokeWidth="12"
            strokeDasharray={`${win * C} ${C}`}
            strokeLinecap={win > 0.025 ? 'butt' : 'round'}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dasharray .3s ease' }}
          />
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
