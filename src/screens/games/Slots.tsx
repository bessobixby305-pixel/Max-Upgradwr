import { useRef, useState } from 'react'
import { BalancePill, BetInput, Header, Sheet } from '../../components/ui'
import { PAY2, SLOT_SYMS, SlotSym, pickSym, slotPayout, slotsRtp } from '../../core/slots'
import { fmt } from '../../core/economy'
import Icon from '../../components/Icon'
import { useGame } from '../../store/game'
import { confetti, haptic, sfx, wait } from '../../lib/fx'

const REEL_LEN = 28
const WIN_AT = 24
const SYM_H = 74

export default function Slots({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [bet, setBet] = useState(100)
  const [reels, setReels] = useState<SlotSym[][]>([[], [], []])
  const [offs, setOffs] = useState([0, 0, 0])
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ mult: number; kind: string } | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)

  const maxBet = Math.max(1, Math.floor(g.balance))
  const fast = g.settings.fastMode

  async function spin() {
    if (spinning) return
    if (!g.bet(bet)) { g.toast('Недостаточно MX'); return }
    setResult(null)
    setSpinning(true)
    sfx.click()

    const got: SlotSym[] = []
    const strips: SlotSym[][] = []
    for (let r = 0; r < 3; r++) {
      const { roll } = g.nextRoll(r)
      const sym = pickSym(roll)
      got.push(sym)
      const strip: SlotSym[] = []
      for (let i = 0; i < REEL_LEN; i++) {
        strip.push(i === WIN_AT ? sym : pickSym(Math.random()))
      }
      strips.push(strip)
    }
    setReels(strips)
    setOffs([0, 0, 0])
    await wait(30)

    const base = fast ? 420 : 1300
    for (let r = 0; r < 3; r++) {
      setOffs((o) => { const n = [...o]; n[r] = -(WIN_AT * SYM_H); return n })
      await wait(fast ? 60 : 190)
    }
    if (!fast) {
      let t = 0
      const tick = () => {
        if (t > base + 400) return
        sfx.tick()
        t += 70
        setTimeout(tick, 70)
      }
      tick()
    }
    await wait(base + (fast ? 120 : 520))

    const pay = slotPayout(got)
    const payout = Math.round(bet * pay.mult)
    if (payout > 0) {
      g.win(payout)
      g.bumpStats({ wins: g.stats.wins + 1 })
      if (pay.kind === 'jackpot' || pay.kind === 'three') {
        confetti(hostRef.current, pay.kind === 'jackpot' ? 200 : 110)
        sfx.bigWin()
        haptic([0, 50, 60, 50, 60, 50])
      } else { sfx.win(); haptic(30) }
    } else {
      g.bumpStats({ losses: g.stats.losses + 1 })
      sfx.lose()
      haptic(110)
    }
    if (pay.kind === 'jackpot') g.bumpStats({ slotJackpots: g.stats.slotJackpots + 1 })
    g.bumpStats({ slotSpins: g.stats.slotSpins + 1 })

    setResult(pay)
    setSpinning(false)
    g.logRound({ kind: 'slots', roll: 0, win: payout > 0, payout })
    g.pushResult({
      kind: 'slots',
      title: `Слоты ${got.map((s) => s.emo).join(' ')}`,
      bet, payout,
      mult: pay.mult || undefined,
      extra: pay.kind === 'jackpot' ? 'ДЖЕКПОТ!' : pay.kind === 'three' ? 'три подряд' : pay.kind === 'two' ? 'две одинаковые' : undefined,
    })
    g.checkAchievements()
  }

  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header
        title="Слоты"
        sub={`RTP ${(slotsRtp() * 100).toFixed(0)}%`}
        onBack={onBack}
        right={<><button className="icon-btn" onClick={() => setPayOpen(true)} aria-label="Выплаты"><Icon name="info" size={21} /></button><BalancePill /></>}
      />
      <div className="screen has-action-bar">
        <div className="pad">
          <div className="slots">
            {[0, 1, 2].map((r) => (
              <div className="slot-reel" key={r}>
                <div
                  className="slot-strip"
                  style={{
                    transform: `translateY(${offs[r]}px)`,
                    transition: spinning
                      ? `transform ${(fast ? 420 : 1300) + r * (fast ? 60 : 190)}ms cubic-bezier(.16,.72,.14,1)`
                      : 'none',
                  }}
                >
                  {(reels[r].length ? reels[r] : SLOT_SYMS).map((s, i) => (
                    <span key={i} className="slot-sym">{s.emo}</span>
                  ))}
                </div>
              </div>
            ))}
            <div className="slot-line" />
          </div>

          {result && (
            <div className="card center pop" style={{ marginTop: 12 }}>
              {result.mult > 0 ? (
                <>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {result.kind === 'jackpot' ? '🦄 ДЖЕКПОТ' : result.kind === 'three' ? 'Три подряд' : 'Две одинаковые'}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 28, fontWeight: 900,
                      // возврат меньше ставки — это всё равно минус, не красим зелёным
                      color: result.mult >= 1 ? 'var(--green)' : 'var(--amber)',
                    }}
                  >
                    +{fmt(bet * result.mult)} MX
                  </div>
                  <div className="muted mono" style={{ fontSize: 12.5 }}>
                    x{result.mult}
                    {result.mult < 1 && ` · −${fmt(bet - bet * result.mult)} чистыми`}
                  </div>
                </>
              ) : (
                <div className="muted">Мимо. Крути ещё.</div>
              )}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <BetInput value={bet} onChange={setBet} max={maxBet} />
          </div>
          <div className="chips" style={{ marginTop: 12 }}>
            <button className={'chip' + (fast ? ' on' : '')} onClick={() => g.setSettings({ fastMode: !fast })}>
              ⚡ Быстро
            </button>
          </div>
        </div>
      </div>

      <div className="action-bar">
        <button className="btn gold" disabled={spinning || bet > maxBet} onClick={spin}>
          {spinning ? 'Крутится…' : `Крутить · ${fmt(bet)} MX`}
        </button>
      </div>

      <Sheet open={payOpen} onClose={() => setPayOpen(false)} title="Таблица выплат">
        <div className="list">
          {[...SLOT_SYMS].reverse().map((s) => (
            <div className="row" key={s.id}>
              <span style={{ fontSize: 22 }}>{s.emo}{s.emo}{s.emo}</span>
              <span className="r mono" style={{ fontWeight: 800 }}>x{s.pay3}</span>
            </div>
          ))}
          <div className="row">
            <span>Две одинаковые</span>
            <span className="r mono" style={{ fontWeight: 800 }}>x{PAY2}</span>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
          Общая отдача набора — {(slotsRtp() * 100).toFixed(2)}%. Символ каждого барабана
          считается из серверного сида отдельным курсором.
        </p>
      </Sheet>
    </div>
  )
}
