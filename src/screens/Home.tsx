import { Route } from '../App'
import DropTicker from '../components/DropTicker'
import Icon from '../components/Icon'
import TileArt from '../components/TileArt'
import { BalancePill } from '../components/ui'
import { CASES } from '../core/cases'
import { DAILY_COOLDOWN, WHEEL_COOLDOWN, fmt, levelFromXp, titleFor } from '../core/economy'
import { useGame } from '../store/game'
import { sfx } from '../lib/fx'
import { GAMES, tintVars } from './Games'

export default function Home({ go, openProfile, openBonus, openGames, openCases }: {
  go: (r: Route) => void
  openProfile: () => void
  openBonus: () => void
  openGames: () => void
  openCases: () => void
}) {
  const g = useGame()
  const lvl = levelFromXp(g.xp)
  const bonusReady =
    Date.now() - g.daily.last >= DAILY_COOLDOWN || Date.now() - g.wheelLast >= WHEEL_COOLDOWN

  return (
    <>
      <div className="hdr">
        <button className="home-logo" onClick={() => go({ s: 'upgrade' })} aria-label="Апгрейд">
          <Icon name="games" size={22} />
        </button>
        <div className="hdr-right">
          <BalancePill />
          <button
            className={'plus-btn' + (bonusReady ? ' ready' : '')}
            onClick={() => { sfx.click(); openBonus() }}
            aria-label="Бонусы"
          >+</button>
          <button className="avatar sm" onClick={openProfile} aria-label="Профиль">
            <Icon name="user" size={17} />
          </button>
        </div>
      </div>

      <div className="screen">
        <DropTicker />

        <div className="pad" style={{ paddingTop: 10 }}>
          <div className="hero">
            <span className="art">🎁</span>
            <div className="rtp">RTP до 97%</div>
            <h2>Крути, пока<br />везёт</h2>
            <p>11 режимов, 12 кейсов и 76 предметов. Каждый раунд считается из серверного сида — результат можно пересчитать самому.</p>
            <button className="btn" style={{ width: 'auto', padding: '13px 26px' }} onClick={() => go({ s: 'cases' })}>
              Открыть кейс
            </button>
          </div>
        </div>

        <div className="sec-head">
          <i /><span>Режимы</span><i />
          <button className="more" onClick={openGames}>все {GAMES.length}</button>
        </div>
        <div className="hscroll">
          {GAMES.slice(0, 7).map((x) => (
            <button
              key={x.r}
              className="gcard"
              style={tintVars(x.tint)}
              onClick={() => { sfx.click(); go({ s: x.r } as Route) }}
            >
              <TileArt art={x.art} emo={x.ico} />
              <span className="gt">{x.t}</span>
              <span className="gs">{x.s}</span>
            </button>
          ))}
        </div>

        <div className="sec-head">
          <i /><span>Кейсы</span><i />
          <button className="more" onClick={openCases}>все {CASES.length}</button>
        </div>
        <div className="pad" style={{ paddingTop: 0 }}>
          <div className="grid2">
            {CASES.slice(0, 6).map((c) => (
              <button
                key={c.id}
                className="gcard"
                style={tintVars(c.tint)}
                onClick={() => { sfx.click(); openCases() }}
              >
                <TileArt art={c.art} emo={c.emo} />
                <span className="gt">{c.name}</span>
                <span className="gs mono">{fmt(c.price)} MX</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sec-head"><i /><span>Профиль</span><i /></div>
        <div className="pad" style={{ paddingTop: 0 }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <b style={{ fontSize: 15 }}>{titleFor(lvl.lvl)} · уровень {lvl.lvl}</b>
              <span className="muted mono" style={{ marginLeft: 'auto', fontSize: 12.5 }}>
                {fmt(g.xp - lvl.cur)} / {fmt(lvl.next - lvl.cur)} XP
              </span>
            </div>
            <div className="progress"><i style={{ width: `${Math.round(lvl.progress * 100)}%` }} /></div>
          </div>
        </div>
      </div>
    </>
  )
}
