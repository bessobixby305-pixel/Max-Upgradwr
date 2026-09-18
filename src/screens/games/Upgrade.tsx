import { useRef, useState } from 'react'
import Wheel from '../../components/Wheel'
import WinOverlay, { WinInfo } from '../../components/WinOverlay'
import { BalancePill, BetInput, Header, ItemCard, Sheet } from '../../components/ui'
import { MAX_MULT, MIN_MULT, UPGRADE_RTP, fmt } from '../../core/economy'
import { ITEM_BY_ID, sortedByPrice } from '../../core/items'
import { useGame } from '../../store/game'
import { confetti, haptic, sfx, wait } from '../../lib/fx'

type Mode = 'mult' | 'item'

const SPIN_MS = 3400
const FAST_MS = 550

export default function Upgrade({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [mode, setMode] = useState<Mode>('mult')
  const [bet, setBet] = useState(100)
  const [mult, setMult] = useState(2)
  const [targetId, setTargetId] = useState('gift_heart')
  const [pickOpen, setPickOpen] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<'win' | 'lose' | null>(null)
  const [auto, setAuto] = useState(0)
  const [winInfo, setWinInfo] = useState<WinInfo | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const stopAuto = useRef(false)

  const maxBet = Math.max(1, Math.floor(g.balance))
  const target = ITEM_BY_ID[targetId]

  const effMult = mode === 'mult' ? mult : target ? target.price / Math.max(1, bet) : 1
  const chance = Math.min(0.95, UPGRADE_RTP / Math.max(MIN_MULT, effMult))
  const payout = Math.round(bet * effMult)
  const canSpin = !spinning && bet >= 1 && bet <= maxBet && effMult >= MIN_MULT

  async function spin() {
    if (!canSpin) return
    if (!g.bet(bet)) { g.toast('Недостаточно MX'); return }
    setResult(null)
    setSpinning(true)
    sfx.click()
    haptic(10)

    const { roll } = g.nextRoll()
    const win = roll < chance
    const dur = g.settings.fastMode ? FAST_MS : SPIN_MS

    // стрелка должна встать ровно на roll*360 после нескольких оборотов
    const turns = g.settings.fastMode ? 2 : 6
    const finalAngle = roll * 360
    setRotation((r) => {
      const base = ((r % 360) + 360) % 360
      return r + turns * 360 + ((finalAngle - base + 360) % 360)
    })

    // тиканье во время вращения
    if (!g.settings.fastMode) {
      let t = 0
      const tickLoop = () => {
        if (t > dur) return
        sfx.tick()
        const k = t / dur
        t += 45 + k * k * 420
        setTimeout(tickLoop, 45 + k * k * 420)
      }
      tickLoop()
    }

    await wait(dur + 120)

    setSpinning(false)
    setResult(win ? 'win' : 'lose')

    const gained = win ? payout : 0
    if (win) {
      // Награда одна: либо MX на баланс, либо предмет в инвентарь.
      if (mode === 'item' && target) {
        g.addItem(target.id)
        g.recordWin(target.price)
        setWinInfo({ itemId: target.id, label: `Апгрейд x${effMult.toFixed(2)}` })
      } else {
        g.win(gained)
        if (effMult >= 5) setWinInfo({ amount: gained, label: `Апгрейд x${effMult.toFixed(2)}` })
      }
      g.bumpStats({
        wins: g.stats.wins + 1,
        bestMult: Math.max(g.stats.bestMult, effMult),
      })
      confetti(hostRef.current, effMult >= 8 ? 140 : 70)
      effMult >= 8 ? sfx.bigWin() : sfx.win()
      haptic([0, 40, 60, 40])
      g.pushResult({
        kind: 'upgrade',
        title: `Апгрейд x${effMult.toFixed(2)}`,
        bet, payout: gained, chance, mult: effMult,
        itemId: mode === 'item' ? targetId : undefined,
      })
    } else {
      g.bumpStats({ losses: g.stats.losses + 1 })
      sfx.lose()
      haptic(160)
      g.pushResult({
        kind: 'upgrade',
        title: `Апгрейд x${effMult.toFixed(2)}`,
        bet, payout: 0, chance, mult: effMult,
      })
    }
    g.bumpStats({ spins: g.stats.spins + 1 })
    g.logRound({ kind: 'upgrade', roll, chance, win, payout: gained })
    g.checkAchievements()

    if (auto > 0 && !stopAuto.current) {
      setAuto((a) => a - 1)
      await wait(g.settings.fastMode ? 180 : 700)
      if (useGame.getState().balance >= bet) void spin()
      else { setAuto(0); g.toast('Автоспин остановлен: не хватает MX') }
    } else if (auto > 0) {
      setAuto(0)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} ref={hostRef}>
      <Header title="Апгрейд" sub="честная игра · RTP 92%" onBack={onBack} right={<BalancePill />} />
      <div className="screen has-action-bar">
        <div className="pad">
          <div className="chips" style={{ marginBottom: 10 }}>
            <button className={'chip' + (mode === 'mult' ? ' on' : '')} onClick={() => setMode('mult')}>
              По множителю
            </button>
            <button className={'chip' + (mode === 'item' ? ' on' : '')} onClick={() => setMode('item')}>
              На предмет
            </button>
            <button
              className={'chip' + (g.settings.fastMode ? ' on' : '')}
              onClick={() => g.setSettings({ fastMode: !g.settings.fastMode })}
            >
              ⚡ Быстро
            </button>
          </div>

          <Wheel
            chance={chance}
            mult={effMult}
            rotation={rotation}
            spinning={spinning}
            result={result}
            durationMs={g.settings.fastMode ? FAST_MS : SPIN_MS}
          />

          <div className="card" style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="muted">Шанс</span>
              <b className="mono">{(chance * 100).toFixed(2)}%</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span className="muted">{mode === 'item' ? 'Приз' : 'Выигрыш'}</span>
              {mode === 'item' && target ? (
                <b style={{ color: 'var(--green)' }}>{target.emo} в инвентарь</b>
              ) : (
                <b className="mono" style={{ color: 'var(--green)' }}>+{fmt(payout)} MX</b>
              )}
            </div>

            {mode === 'mult' ? (
              <>
                <input
                  type="range"
                  min={Math.log(MIN_MULT)}
                  max={Math.log(MAX_MULT)}
                  step={0.001}
                  value={Math.log(mult)}
                  onChange={(e) => setMult(+Math.exp(+e.target.value).toFixed(2))}
                />
                <div className="chips">
                  {[1.5, 2, 3, 5, 10, 25, 50].map((m) => (
                    <button
                      key={m}
                      className={'chip' + (Math.abs(mult - m) < 0.01 ? ' on' : '')}
                      onClick={() => setMult(m)}
                    >x{m}</button>
                  ))}
                </div>
              </>
            ) : (
              <button className="row" style={{ borderRadius: 14, background: 'var(--bg-sub)' }} onClick={() => setPickOpen(true)}>
                <span style={{ fontSize: 28 }}>{target?.emo}</span>
                <span>
                  <div className="t">{target?.name}</div>
                  <div className="s mono">{fmt(target?.price ?? 0)} MX</div>
                </span>
                <span className="r">Выбрать ›</span>
              </button>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <BetInput value={bet} onChange={setBet} max={maxBet} />
          </div>

          <p className="muted" style={{ fontSize: 12.5, marginTop: 14, lineHeight: 1.5 }}>
            Шанс = 92% ÷ множитель. Результат раунда считается из серверного сида,
            хэш которого показан заранее — проверить можно в Профиле → Честная игра.
          </p>
        </div>
      </div>

      <div className="action-bar">
        <button className="btn" disabled={!canSpin} onClick={() => { stopAuto.current = false; void spin() }}>
          {spinning ? 'Крутится…' : `Крутить · ${fmt(bet)} MX`}
        </button>
        <button
          className="btn ghost"
          style={{ width: 102, flex: 'none' }}
          onClick={() => {
            if (auto > 0) { stopAuto.current = true; setAuto(0); return }
            stopAuto.current = false
            setAuto(10)
            void spin()
          }}
        >
          {auto > 0 ? `Стоп ${auto}` : 'Авто 10'}
        </button>
      </div>

      <WinOverlay win={winInfo} onClose={() => setWinInfo(null)} />

      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title="Цель апгрейда">
        <div className="grid">
          {sortedByPrice.map((it) => (
            <ItemCard
              key={it.id}
              id={it.id}
              selected={it.id === targetId}
              onClick={() => { setTargetId(it.id); setPickOpen(false); sfx.click() }}
            />
          ))}
        </div>
      </Sheet>
    </div>
  )
}
