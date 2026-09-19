import { useRef, useState } from 'react'
import { BalancePill, BetInput, Header } from '../../components/ui'
import { fmt } from '../../core/economy'
import { MINES_SIZE, minesField, minesMult } from '../../core/games'
import { useGame } from '../../store/game'
import { applyServerRound, localRng, onlineMode, serverCall } from '../../lib/round'
import { confetti, haptic, sfx } from '../../lib/fx'

const SIZE = MINES_SIZE
const multFor = minesMult

export default function Mines({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [bet, setBet] = useState(100)
  const [mines, setMines] = useState(3)
  const [field, setField] = useState<boolean[]>([])   // true = мина
  const [opened, setOpened] = useState<number[]>([])
  const [playing, setPlaying] = useState(false)
  const [dead, setDead] = useState(false)
  const [busy, setBusy] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)

  const safeOpened = opened.length
  const mult = multFor(mines, safeOpened)
  const nextMult = multFor(mines, safeOpened + 1)
  const cashout = Math.round(bet * mult)
  const maxBet = Math.max(1, Math.floor(g.balance))

  async function start() {
    if (busy || playing) return
    setBusy(true)
    try {
      if (onlineMode()) {
        // раскладка остаётся на сервере — здесь поле пустое до первого хода
        const r = await serverCall<{ balance: number }>('/play/mines/start', { bet, mines })
        g.setServerState({ balance: r.balance, xp: g.xp })
        setField([])
      } else {
        if (!g.bet(bet)) throw new Error('Недостаточно MX')
        const bombs = new Set(minesField(localRng(), mines))
        setField([...Array(SIZE)].map((_, i) => bombs.has(i)))
      }
      setOpened([])
      setPlaying(true)
      setDead(false)
      sfx.click()
    } catch (e) {
      g.toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function boom(openedCount: number) {
    setDead(true)
    setPlaying(false)
    sfx.boom()
    haptic([0, 90, 70, 140])
    g.pushResult({
      kind: 'mines', title: `Мины · ${mines} мин`, bet, payout: 0,
      extra: `открыто клеток: ${openedCount}`,
    })
  }

  async function openCell(i: number) {
    if (!playing || busy || opened.includes(i)) return
    if (onlineMode()) {
      setBusy(true)
      try {
        const r = await serverCall<any>('/play/mines/open', { cell: i })
        if (r.bomb) {
          setField([...Array(SIZE)].map((_, k) => (r.bombs as number[]).includes(k)))
          setOpened(r.opened)
          applyServerRound(r)
          boom(r.opened.length)
        } else if (r.payout !== undefined) {
          // поле пройдено целиком — сервер забрал выигрыш сам
          setOpened(r.opened)
          applyServerRound(r)
          cashedOut(r.opened.length, r.payout)
        } else {
          setOpened(r.opened)
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

    if (field[i]) {
      g.bumpStats({ spins: g.stats.spins + 1, losses: g.stats.losses + 1 })
      g.checkAchievements()
      boom(safeOpened)
      return
    }
    const next = [...opened, i]
    setOpened(next)
    sfx.coin()
    haptic(8)
    if (next.length === SIZE - mines) void finish(next.length)
  }

  function cashedOut(k: number, payout: number) {
    setPlaying(false)
    setDead(false)
    setField([])
    setOpened([])
    confetti(hostRef.current, 70)
    sfx.win()
    haptic([0, 40, 50, 40])
    g.pushResult({
      kind: 'mines', title: `Мины · ${mines} мин`, bet, payout,
      mult: multFor(mines, k), extra: `открыто клеток: ${k}`,
    })
  }

  async function finish(k = safeOpened) {
    if (busy) return
    if (onlineMode()) {
      setBusy(true)
      try {
        const r = await serverCall<any>('/play/mines/cashout', {})
        applyServerRound(r)
        cashedOut(k, r.payout)
      } catch (e) {
        g.toast((e as Error).message)
      } finally {
        setBusy(false)
      }
      return
    }
    const payout = Math.round(bet * multFor(mines, k))
    g.win(payout)
    g.bumpStats({
      spins: g.stats.spins + 1,
      wins: g.stats.wins + 1,
      minesCashouts: g.stats.minesCashouts + 1,
    })
    g.checkAchievements()
    cashedOut(k, payout)
  }

  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header title="Мины" sub="поле 5×5" onBack={onBack} right={<BalancePill />} />
      <div className="screen">
        <div className="pad">
          <div className="card" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>x{mult.toFixed(2)}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>сейчас</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{fmt(cashout)}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>забрать</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-2)' }}>x{nextMult.toFixed(2)}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>следующая</div>
            </div>
          </div>

          <div className="mines-grid" style={{ marginBottom: 14 }}>
            {[...Array(SIZE)].map((_, i) => {
              const isOpen = opened.includes(i)
              const reveal = dead && field[i]
              return (
                <button
                  key={i}
                  className={
                    'mine-cell' +
                    (isOpen ? ' open' : '') +
                    (reveal ? ' boom' : '') +
                    (dead && !isOpen && !reveal ? ' rev' : '')
                  }
                  onClick={() => openCell(i)}
                  disabled={!playing}
                >
                  {isOpen ? '💎' : reveal ? '💣' : ''}
                </button>
              )
            })}
          </div>

          {!playing ? (
            <>
              <BetInput value={bet} onChange={setBet} max={maxBet} />
              <div className="chips" style={{ margin: '12px 0' }}>
                {[1, 3, 5, 10, 15, 24].map((m) => (
                  <button key={m} className={'chip' + (mines === m ? ' on' : '')} onClick={() => setMines(m)}>
                    {m} 💣
                  </button>
                ))}
              </div>
              <button className="btn" disabled={busy || bet > maxBet} onClick={start}>
                {dead ? 'Ещё раз' : 'Начать'} · {fmt(bet)} MX
              </button>
            </>
          ) : (
            <button className="btn" disabled={busy || safeOpened === 0} onClick={() => finish()}>
              Забрать {fmt(cashout)} MX
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
