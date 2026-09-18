import { Route } from '../App'
import { BalancePill, Header } from '../components/ui'
import { DAILY_COOLDOWN, WHEEL_COOLDOWN, dailyReward, fmt, levelFromXp, titleFor } from '../core/economy'
import { useGame } from '../store/game'
import { sfx } from '../lib/fx'

interface G { r: Route['s']; t: string; s: string; ico: string; grad: string }

const GAMES: G[] = [
  { r: 'upgrade', t: 'Апгрейд', s: 'x1.05 — x50', ico: '🎰', grad: 'linear-gradient(135deg,#7C5CFF,#3F8CFF)' },
  { r: 'cases', t: 'Кейсы', s: '5 кейсов', ico: '📦', grad: 'linear-gradient(135deg,#FF4FA3,#C41E6B)' },
  { r: 'mines', t: 'Мины', s: 'поле 5×5', ico: '💣', grad: 'linear-gradient(135deg,#2FBF61,#0E7A3C)' },
  { r: 'crash', t: 'Краш', s: 'успей забрать', ico: '🚀', grad: 'linear-gradient(135deg,#FFB020,#FF6A00)' },
  { r: 'contract', t: 'Контракт', s: '3–10 предметов', ico: '📝', grad: 'linear-gradient(135deg,#A25CFF,#6A2FD6)' },
  { r: 'battle', t: 'Битва кейсов', s: 'против ботов', ico: '⚔️', grad: 'linear-gradient(135deg,#3F8CFF,#1E4FB8)' },
]

export default function Games({ go }: { go: (r: Route) => void }) {
  const g = useGame()
  const lvl = levelFromXp(g.xp)
  const dailyReady = Date.now() - g.daily.last >= DAILY_COOLDOWN
  const wheelReady = Date.now() - g.wheelLast >= WHEEL_COOLDOWN
  const nextStreak = Math.min(g.daily.streak + 1, 7)

  const claim = () => {
    const r = g.claimDaily()
    if (r) { sfx.coin(); g.toast(`🎁 +${fmt(r)} MX · день ${g.daily.streak}`) }
  }

  return (
    <>
      <Header title="Игры" sub={`${titleFor(lvl.lvl)} · ур. ${lvl.lvl}`} right={<BalancePill />} />
      <div className="screen">
        <div className="pad">
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <b style={{ fontSize: 15 }}>Уровень {lvl.lvl}</b>
              <span className="muted mono" style={{ marginLeft: 'auto', fontSize: 12.5 }}>
                {fmt(g.xp - lvl.cur)} / {fmt(lvl.next - lvl.cur)} XP
              </span>
            </div>
            <div className="progress"><i style={{ width: `${Math.round(lvl.progress * 100)}%` }} /></div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <button
              className={'btn' + (dailyReady ? '' : ' ghost')}
              disabled={!dailyReady}
              onClick={claim}
              style={{ flexDirection: 'column', gap: 2, padding: '13px 10px' }}
            >
              <span style={{ fontSize: 14 }}>🎁 Ежедневный</span>
              <span style={{ fontSize: 11.5, opacity: .85, fontWeight: 600 }}>
                {dailyReady ? `+${fmt(dailyReward(nextStreak))} · день ${nextStreak}` : 'завтра'}
              </span>
            </button>
            <button
              className={'btn' + (wheelReady ? '' : ' ghost')}
              onClick={() => go({ s: 'wheel' })}
              style={{ flexDirection: 'column', gap: 2, padding: '13px 10px' }}
            >
              <span style={{ fontSize: 14 }}>🎡 Колесо дня</span>
              <span style={{ fontSize: 11.5, opacity: .85, fontWeight: 600 }}>
                {wheelReady ? 'бесплатно' : 'через 8 ч'}
              </span>
            </button>
          </div>

          <div className="grid2">
            {GAMES.map((x) => (
              <button
                key={x.r}
                className="gcard"
                style={{ background: x.grad }}
                onClick={() => { sfx.click(); go({ s: x.r } as Route) }}
              >
                <span className="gico">{x.ico}</span>
                <span className="gt">{x.t}</span>
                <span className="gs">{x.s}</span>
              </button>
            ))}
          </div>

          {g.balance <= 50 && (
            <div className="card" style={{ marginTop: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 30 }}>🛟</div>
              <b>Закончились MX?</b>
              <p className="muted" style={{ fontSize: 13 }}>
                Забери спасательный круг — 100 MX раз в 15 минут.
              </p>
              <button
                className="btn"
                onClick={() => {
                  if (g.claimRescue()) { sfx.coin(); g.toast('🛟 +100 MX') }
                  else g.toast('Ещё рано, подожди немного')
                }}
              >Забрать 100 MX</button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
