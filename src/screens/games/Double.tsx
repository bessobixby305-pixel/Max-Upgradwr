import { useRef, useState } from 'react'
import { BalancePill, BetInput, Header } from '../../components/ui'
import { fmt } from '../../core/economy'
import { DOUBLE_MULT, DOUBLE_SLOTS, DoubleColor, playDouble } from '../../core/games'
import { useGame } from '../../store/game'
import { playInstant } from '../../lib/round'
import { confetti, haptic, sfx, wait } from '../../lib/fx'

type Color = DoubleColor

const SLOTS = DOUBLE_SLOTS
const MULT = DOUBLE_MULT
const LABEL: Record<Color, string> = { red: 'Красное', black: 'Чёрное', green: 'Зелёное' }
const TINT: Record<Color, string> = {
  red: '#D94437',
  black: '#2E323B',
  green: '#1E9E52',
}

const CELL = 62
const WIN_INDEX = 40
const STRIP = 54
const ROLL_MS = 4000
const FAST_MS = 700

export default function Double({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [bet, setBet] = useState(100)
  const [pick, setPick] = useState<Color>('red')
  const [strip, setStrip] = useState<Color[]>([])
  const [offset, setOffset] = useState(0)
  const [rolling, setRolling] = useState(false)
  const [landed, setLanded] = useState<Color | null>(null)
  const [history, setHistory] = useState<Color[]>([])
  const hostRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const maxBet = Math.max(1, Math.floor(g.balance))
  const fast = g.settings.fastMode

  async function spin() {
    if (rolling) return
    setLanded(null)
    setRolling(true)
    sfx.click()

    let res
    try {
      res = await playInstant({
        kind: 'double', bet,
        path: '/play/double', body: { bet, pick },
        local: (rng) => playDouble(rng, { bet, pick }),
        bump: (o) => (o.detail.color === 'green' ? { doubleGreens: g.stats.doubleGreens + 1 } : {}),
      })
    } catch (e) {
      setRolling(false)
      g.toast((e as Error).message)
      return
    }
    const color = res.outcome.detail.color as Color

    const s: Color[] = []
    for (let i = 0; i < STRIP; i++) {
      s.push(i === WIN_INDEX ? color : SLOTS[(Math.random() * SLOTS.length) | 0])
    }
    setStrip(s)
    setOffset(0)
    await wait(30)

    const w = boxRef.current?.clientWidth ?? 340
    const jitter = (Math.random() - 0.5) * (CELL - 18)
    setOffset(-(WIN_INDEX * CELL) + w / 2 - (CELL - 8) / 2 + jitter)

    const dur = fast ? FAST_MS : ROLL_MS
    if (!fast) {
      let t = 0
      const tick = () => {
        if (t > dur) return
        sfx.tick()
        const k = t / dur
        t += 50 + k * k * 470
        setTimeout(tick, 50 + k * k * 470)
      }
      tick()
    }
    await wait(dur + 140)

    const won = res.outcome.win
    const payout = res.outcome.payout
    if (won) {
      confetti(hostRef.current, color === 'green' ? 150 : 70)
      color === 'green' ? sfx.bigWin() : sfx.win()
      haptic([0, 40, 60, 40])
    } else {
      sfx.lose()
      haptic(130)
    }

    setLanded(color)
    setHistory((h) => [color, ...h].slice(0, 14))
    setRolling(false)
    g.pushResult({
      kind: 'double',
      title: `Дабл · ${LABEL[color]}`,
      bet, payout,
      mult: won ? MULT[color] : undefined,
      extra: `ставка на ${LABEL[pick].toLowerCase()}`,
    })
  }

  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header title="Дабл" sub="красное · чёрное · зелёное" onBack={onBack} right={<BalancePill />} />
      <div className="screen has-action-bar">
        <div className="pad">
          <div className="roller" ref={boxRef} style={{ height: 88 }}>
            <div className="roller-mark" />
            <div
              className="roller-track"
              style={{
                transform: `translateX(${offset}px)`,
                transition: rolling ? `transform ${fast ? FAST_MS : ROLL_MS}ms cubic-bezier(.08,.72,.11,1)` : 'none',
                padding: '10px 0',
              }}
            >
              {strip.length ? strip.map((c, i) => (
                <div key={i} className="dbl-cell" style={{ background: TINT[c] }}>
                  {c === 'green' ? '14' : '2'}
                </div>
              )) : (
                <div className="center muted" style={{ width: '100%', padding: 26 }}>
                  Выбери цвет и крути
                </div>
              )}
            </div>
          </div>

          {landed && (
            <div className="card center pop" style={{ marginBottom: 12 }}>
              <div className="muted" style={{ fontSize: 12.5 }}>Выпало</div>
              <div style={{ fontSize: 22, fontWeight: 850, color: landed === 'red' ? 'var(--red)' : landed === 'green' ? 'var(--green)' : 'var(--text)' }}>
                {LABEL[landed]} · x{MULT[landed]}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {history.map((c, i) => (
                <span key={i} className="dbl-dot" style={{ background: TINT[c] }} />
              ))}
            </div>
          )}

          <div className="grid" style={{ marginBottom: 14 }}>
            {(['red', 'green', 'black'] as Color[]).map((c) => (
              <button
                key={c}
                className="dbl-pick"
                style={{
                  background: TINT[c],
                  outline: pick === c ? '2px solid var(--text)' : 'none',
                  outlineOffset: 2,
                }}
                onClick={() => { setPick(c); sfx.click() }}
              >
                <span style={{ fontSize: 19, fontWeight: 900 }}>x{MULT[c]}</span>
                <span style={{ fontSize: 11.5, opacity: .9, fontWeight: 650 }}>{LABEL[c]}</span>
                <span style={{ fontSize: 10.5, opacity: .75 }}>
                  {c === 'green' ? '6.7%' : '46.7%'}
                </span>
              </button>
            ))}
          </div>

          <BetInput value={bet} onChange={setBet} max={maxBet} />

          <p className="muted" style={{ fontSize: 12.5, marginTop: 14, lineHeight: 1.5 }}>
            15 слотов: 7 красных, 7 чёрных и 1 зелёный. Отдача 93.3%.
            Номер слота считается из серверного сида — проверяется в профиле.
          </p>
        </div>
      </div>

      <div className="action-bar">
        <button className="btn" disabled={rolling || bet > maxBet} onClick={spin}>
          {rolling ? 'Крутится…' : `Поставить ${fmt(bet)} MX на ${LABEL[pick].toLowerCase()}`}
        </button>
      </div>
    </div>
  )
}
