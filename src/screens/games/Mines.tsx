import { useRef, useState } from 'react'
import { BalancePill, BetInput, Header } from '../../components/ui'
import { fmt } from '../../core/economy'
import { seededShuffle } from '../../core/fair'
import { useGame } from '../../store/game'
import { confetti, haptic, sfx } from '../../lib/fx'

const SIZE = 25
const RTP = 0.97

/** Множитель после k открытых безопасных клеток при m минах. */
function multFor(m: number, k: number) {
  if (k === 0) return 1
  let mult = 1
  for (let i = 0; i < k; i++) mult *= (SIZE - i) / (SIZE - m - i)
  return mult * RTP
}

export default function Mines({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [bet, setBet] = useState(100)
  const [mines, setMines] = useState(3)
  const [field, setField] = useState<boolean[]>([])   // true = мина
  const [opened, setOpened] = useState<number[]>([])
  const [playing, setPlaying] = useState(false)
  const [dead, setDead] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)

  const safeOpened = opened.length
  const mult = multFor(mines, safeOpened)
  const nextMult = multFor(mines, safeOpened + 1)
  const cashout = Math.round(bet * mult)
  const maxBet = Math.max(1, Math.floor(g.balance))

  function start() {
    if (!g.bet(bet)) { g.toast('Недостаточно MX'); return }
    const { roll } = g.nextRoll()
    const idx = seededShuffle([...Array(SIZE).keys()], g.fair.serverSeed, g.fair.clientSeed, g.fair.nonce)
    const bombs = new Set(idx.slice(0, mines))
    setField([...Array(SIZE)].map((_, i) => bombs.has(i)))
    setOpened([])
    setPlaying(true)
    setDead(false)
    sfx.click()
    g.logRound({ kind: 'mines', roll, win: false, payout: 0 })
  }

  function openCell(i: number) {
    if (!playing || opened.includes(i)) return
    if (field[i]) {
      setDead(true)
      setPlaying(false)
      sfx.boom()
      haptic([0, 90, 70, 140])
      g.bumpStats({ losses: g.stats.losses + 1 })
      g.pushResult({
        kind: 'mines', title: `Мины · ${mines} мин`, bet, payout: 0,
        extra: `открыто клеток: ${safeOpened}`,
      })
      g.checkAchievements()
      return
    }
    const next = [...opened, i]
    setOpened(next)
    sfx.coin()
    haptic(8)
    if (next.length === SIZE - mines) finish(next.length)
  }

  function finish(k = safeOpened) {
    const payout = Math.round(bet * multFor(mines, k))
    g.win(payout)
    setPlaying(false)
    setDead(false)
    setField([])
    setOpened([])
    confetti(hostRef.current, 70)
    sfx.win()
    haptic([0, 40, 50, 40])
    g.bumpStats({
      wins: g.stats.wins + 1,
      minesCashouts: g.stats.minesCashouts + 1,
    })
    g.pushResult({
      kind: 'mines', title: `Мины · ${mines} мин`, bet, payout,
      mult: multFor(mines, k), extra: `открыто клеток: ${k}`,
    })
    g.checkAchievements()
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
              <button className="btn" disabled={bet > maxBet} onClick={start}>
                {dead ? 'Ещё раз' : 'Начать'} · {fmt(bet)} MX
              </button>
            </>
          ) : (
            <button className="btn" disabled={safeOpened === 0} onClick={() => finish()}>
              Забрать {fmt(cashout)} MX
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
