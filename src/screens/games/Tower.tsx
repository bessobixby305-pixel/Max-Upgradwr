import { useRef, useState } from 'react'
import { BalancePill, BetInput, Header } from '../../components/ui'
import { fmt } from '../../core/economy'
import { TOWER_FLOORS, towerMult, towerRows } from '../../core/games'
import { useGame } from '../../store/game'
import { applyServerRound, localRng, onlineMode, serverCall } from '../../lib/round'
import { confetti, haptic, sfx } from '../../lib/fx'

const FLOORS = TOWER_FLOORS
const multFor = towerMult

export default function Tower({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [bet, setBet] = useState(100)
  const [bombs, setBombs] = useState(1)
  /** для каждого этажа — индексы безопасных клеток */
  const [safe, setSafe] = useState<number[][]>([])
  const [picked, setPicked] = useState<number[]>([])
  const [playing, setPlaying] = useState(false)
  const [dead, setDead] = useState(false)
  const [busy, setBusy] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)

  const floor = picked.length
  const mult = multFor(bombs, floor)
  const nextMult = multFor(bombs, floor + 1)
  const cashout = Math.round(bet * mult)
  const maxBet = Math.max(1, Math.floor(g.balance))

  async function start() {
    if (busy || playing) return
    setBusy(true)
    try {
      if (onlineMode()) {
        // безопасные клетки знает только сервер
        const r = await serverCall<{ balance: number }>('/play/tower/start', { bet, bombs })
        g.setServerState({ balance: r.balance, xp: g.xp })
        setSafe([])
      } else {
        if (!g.bet(bet)) throw new Error('Недостаточно MX')
        setSafe(towerRows(localRng(), bombs))
      }
      setPicked([])
      setPlaying(true)
      setDead(false)
      sfx.click()
    } catch (e) {
      g.toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function fell(col: number, f: number) {
    setPicked((p) => [...p, col])
    setPlaying(false)
    setDead(true)
    sfx.boom()
    haptic([0, 90, 70, 140])
    g.pushResult({
      kind: 'tower', title: `Башня · ${bombs} мин в ряду`, bet, payout: 0,
      extra: `этажей пройдено: ${f}`,
    })
  }

  async function pickCell(col: number) {
    if (!playing || busy) return
    const f = picked.length

    if (onlineMode()) {
      setBusy(true)
      try {
        const r = await serverCall<any>('/play/tower/pick', { col })
        if (r.dead) {
          setSafe(r.rows)
          applyServerRound(r)
          fell(col, f)
        } else if (r.payout !== undefined) {
          // башня пройдена до верха — сервер закрыл раунд сам
          setPicked(r.picked)
          applyServerRound(r)
          cashedOut(r.picked.length, r.payout)
        } else {
          setSafe((rows) => { const n = [...rows]; n[f] = r.safe; return n })
          setPicked(r.picked)
          sfx.coin()
          haptic(8)
        }
      } catch (e) {
        g.toast((e as Error).message)
      } finally {
        setBusy(false)
      }
      return
    }

    if (!safe[f].includes(col)) {
      g.bumpStats({ spins: g.stats.spins + 1, losses: g.stats.losses + 1 })
      g.checkAchievements()
      fell(col, f)
      return
    }
    const next = [...picked, col]
    setPicked(next)
    sfx.coin()
    haptic(8)
    if (next.length === FLOORS) void finish(next.length)
  }

  function cashedOut(f: number, payout: number) {
    setPlaying(false)
    setDead(false)
    setSafe([])
    setPicked([])
    confetti(hostRef.current, f >= FLOORS ? 150 : 70)
    f >= FLOORS ? sfx.bigWin() : sfx.win()
    haptic([0, 40, 50, 40])
    g.pushResult({
      kind: 'tower', title: `Башня · ${bombs} мин в ряду`, bet, payout,
      mult: multFor(bombs, f), extra: `этажей пройдено: ${f}`,
    })
  }

  async function finish(f = floor) {
    if (busy) return
    if (onlineMode()) {
      setBusy(true)
      try {
        const r = await serverCall<any>('/play/tower/cashout', {})
        applyServerRound(r)
        cashedOut(f, r.payout)
      } catch (e) {
        g.toast((e as Error).message)
      } finally {
        setBusy(false)
      }
      return
    }
    const payout = Math.round(bet * multFor(bombs, f))
    g.win(payout)
    g.bumpStats({
      spins: g.stats.spins + 1,
      wins: g.stats.wins + 1,
      towerCashouts: g.stats.towerCashouts + 1,
      towerBestFloor: Math.max(g.stats.towerBestFloor, f),
    })
    g.checkAchievements()
    cashedOut(f, payout)
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
          <button className="btn" disabled={busy || floor === 0} onClick={() => finish()}>
            Забрать {fmt(cashout)} MX
          </button>
        ) : (
          <button className="btn" disabled={busy || bet > maxBet} onClick={start}>
            {dead ? 'Ещё раз' : 'Начать'} · {fmt(bet)} MX
          </button>
        )}
      </div>
    </div>
  )
}
