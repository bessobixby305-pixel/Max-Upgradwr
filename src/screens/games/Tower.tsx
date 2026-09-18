import { useRef, useState } from 'react'
import { BalancePill, BetInput, Header } from '../../components/ui'
import { fmt } from '../../core/economy'
import { seededShuffle } from '../../core/fair'
import { useGame } from '../../store/game'
import { confetti, haptic, sfx } from '../../lib/fx'

const FLOORS = 8
const COLS = 3
const RTP = 0.97

/** Множитель после n пройденных этажей при заданном числе мин в ряду. */
function multFor(bombs: number, floors: number) {
  return floors === 0 ? 1 : RTP * Math.pow(COLS / (COLS - bombs), floors)
}

export default function Tower({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [bet, setBet] = useState(100)
  const [bombs, setBombs] = useState(1)
  /** для каждого этажа — индексы безопасных клеток */
  const [safe, setSafe] = useState<number[][]>([])
  const [picked, setPicked] = useState<number[]>([])
  const [playing, setPlaying] = useState(false)
  const [dead, setDead] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)

  const floor = picked.length
  const mult = multFor(bombs, floor)
  const nextMult = multFor(bombs, floor + 1)
  const cashout = Math.round(bet * mult)
  const maxBet = Math.max(1, Math.floor(g.balance))

  function start() {
    if (!g.bet(bet)) { g.toast('Недостаточно MX'); return }
    const { roll, nonce } = g.nextRoll()
    const rows: number[][] = []
    for (let f = 0; f < FLOORS; f++) {
      const order = seededShuffle([0, 1, 2], g.fair.serverSeed, g.fair.clientSeed, nonce + f)
      rows.push(order.slice(bombs)) // остальные — безопасные
    }
    setSafe(rows)
    setPicked([])
    setPlaying(true)
    setDead(false)
    sfx.click()
    g.logRound({ kind: 'tower', roll, win: false, payout: 0 })
  }

  function pickCell(col: number) {
    if (!playing) return
    const f = picked.length
    if (!safe[f].includes(col)) {
      setPicked([...picked, col])
      setPlaying(false)
      setDead(true)
      sfx.boom()
      haptic([0, 90, 70, 140])
      g.bumpStats({ losses: g.stats.losses + 1 })
      g.pushResult({
        kind: 'tower', title: `Башня · ${bombs} мин в ряду`, bet, payout: 0,
        extra: `этажей пройдено: ${f}`,
      })
      g.checkAchievements()
      return
    }
    const next = [...picked, col]
    setPicked(next)
    sfx.coin()
    haptic(8)
    if (next.length === FLOORS) finish(next.length)
  }

  function finish(f = floor) {
    const payout = Math.round(bet * multFor(bombs, f))
    g.win(payout)
    setPlaying(false)
    setDead(false)
    setSafe([])
    setPicked([])
    confetti(hostRef.current, f >= FLOORS ? 150 : 70)
    f >= FLOORS ? sfx.bigWin() : sfx.win()
    haptic([0, 40, 50, 40])
    g.bumpStats({
      wins: g.stats.wins + 1,
      towerCashouts: g.stats.towerCashouts + 1,
      towerBestFloor: Math.max(g.stats.towerBestFloor, f),
    })
    g.pushResult({
      kind: 'tower', title: `Башня · ${bombs} мин в ряду`, bet, payout,
      mult: multFor(bombs, f), extra: `этажей пройдено: ${f}`,
    })
    g.checkAchievements()
  }

  // этажи рисуем сверху вниз
  const rows = [...Array(FLOORS)].map((_, i) => FLOORS - 1 - i)

  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header title="Башня" sub={`${FLOORS} этажей вверх`} onBack={onBack} right={<BalancePill />} />
      <div className="screen has-action-bar">
        <div className="pad">
          <div className="card" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div className="mono" style={{ fontSize: 21, fontWeight: 850 }}>{floor}/{FLOORS}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>этаж</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 21, fontWeight: 850, color: 'var(--green)' }}>{fmt(cashout)}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>забрать</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 21, fontWeight: 850, color: 'var(--text-2)' }}>x{nextMult.toFixed(2)}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>следующий</div>
            </div>
          </div>

          <div className="tower" style={{ marginBottom: 14 }}>
            {rows.map((f) => {
              const done = f < picked.length
              const current = playing && f === picked.length
              const lost = dead && f === picked.length - 1
              return (
                <div key={f} className={'tower-row' + (current ? ' cur' : '')}>
                  <span className="tower-num mono">{f + 1}</span>
                  {[0, 1, 2].map((c) => {
                    const isPick = done && picked[f] === c
                    const isBomb = (dead || !playing) && safe[f] && !safe[f].includes(c)
                    return (
                      <button
                        key={c}
                        className={
                          'tower-cell' +
                          (isPick ? (lost && picked[f] === c ? ' boom' : ' ok') : '') +
                          (current ? ' active' : '')
                        }
                        disabled={!current}
                        onClick={() => pickCell(c)}
                      >
                        {isPick ? (lost && picked[f] === c ? '💥' : '💎') : isBomb ? '💣' : ''}
                      </button>
                    )
                  })}
                  <span className="tower-mult mono">x{multFor(bombs, f + 1).toFixed(2)}</span>
                </div>
              )
            })}
          </div>

          {!playing && (
            <>
              <BetInput value={bet} onChange={setBet} max={maxBet} />
              <div className="chips" style={{ marginTop: 12 }}>
                {[1, 2].map((b) => (
                  <button key={b} className={'chip' + (bombs === b ? ' on' : '')} onClick={() => setBombs(b)}>
                    {b} 💣 в ряду · x{multFor(b, 1).toFixed(2)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="action-bar">
        {playing ? (
          <button className="btn" disabled={floor === 0} onClick={() => finish()}>
            Забрать {fmt(cashout)} MX
          </button>
        ) : (
          <button className="btn" disabled={bet > maxBet} onClick={start}>
            {dead ? 'Ещё раз' : 'Начать'} · {fmt(bet)} MX
          </button>
        )}
      </div>
    </div>
  )
}
