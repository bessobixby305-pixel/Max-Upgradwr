import { Route } from '../App'
import { BalancePill, Header } from '../components/ui'
import { DAILY_COOLDOWN, WHEEL_COOLDOWN, dailyReward, fmt, levelFromXp, titleFor } from '../core/economy'
import { CASES } from '../core/cases'
import { useGame } from '../store/game'
import { sfx } from '../lib/fx'

interface G { r: Route['s']; t: string; s: string; ico: string; tint: string }

const GAMES: G[] = [
  { r: 'upgrade', t: 'Апгрейд', s: 'x1.05 — x50', ico: '🎰', tint: '#4B49E5' },
  { r: 'cases', t: 'Кейсы', s: `${CASES.length} кейсов`, ico: '📦', tint: '#C7467E' },
  { r: 'mines', t: 'Мины', s: 'поле 5×5', ico: '💣', tint: '#1E9E52' },
  { r: 'crash', t: 'Краш', s: 'успей забрать', ico: '🚀', tint: '#C98411' },
  { r: 'contract', t: 'Контракт', s: '3–10 предметов', ico: '📝', tint: '#8557CE' },
  { r: 'battle', t: 'Битва кейсов', s: 'против ботов', ico: '⚔️', tint: '#3B7FC4' },
  { r: 'double', t: 'Дабл', s: 'x2 и x14', ico: '🔴', tint: '#D94437' },
  { r: 'dice', t: 'Кости', s: 'больше / меньше', ico: '🎲', tint: '#12938D' },
  { r: 'tower', t: 'Башня', s: '8 этажей вверх', ico: '🗼', tint: '#6A56D6' },
  { r: 'slots', t: 'Слоты', s: 'три семёрки', ico: '🎰', tint: '#C98411' },
  { r: 'jackpot', t: 'Джекпот', s: 'банк забирает один', ico: '🏦', tint: '#1E9E52' },
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
              style={{ flexDirection: 'column', gap: 1, padding: '11px 10px' }}
            >
              <span style={{ fontSize: 14 }}>Ежедневный бонус</span>
              <span style={{ fontSize: 11.5, opacity: .85, fontWeight: 600 }}>
                {dailyReady ? `+${fmt(dailyReward(nextStreak))} · день ${nextStreak}` : 'завтра'}
              </span>
            </button>
            <button
              className="btn outline"
              onClick={() => go({ s: 'wheel' })}
              style={{ flexDirection: 'column', gap: 1, padding: '11px 10px' }}
            >
              <span style={{ fontSize: 14 }}>Колесо дня</span>
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
                onClick={() => { sfx.click(); go({ s: x.r } as Route) }}
              >
                <span
                  className="gico"
                  style={{ ['--tint' as any]: `color-mix(in srgb, ${x.tint} 14%, transparent)` }}
                >{x.ico}</span>
                <span className="gt">{x.t}</span>
                <span className="gs">{x.s}</span>
              </button>
            ))}
          </div>

          {g.balance <= 50 && (
            <div className="card" style={{ marginTop: 14, textAlign: 'center' }}>
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
