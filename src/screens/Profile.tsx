import { useState } from 'react'
import { Route } from '../App'
import { BalancePill, Header, Sheet } from '../components/ui'
import { ACHIEVEMENTS, PROMOS, fmt, levelFromXp, titleFor } from '../core/economy'
import { useGame } from '../store/game'
import Icon, { IconName } from '../components/Icon'
import { sfx } from '../lib/fx'

export default function Profile({ go }: { go: (r: Route) => void }) {
  const g = useGame()
  const lvl = levelFromXp(g.xp)
  const [promoOpen, setPromoOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [code, setCode] = useState('')
  const [saveText, setSaveText] = useState('')

  const winrate = g.stats.spins ? (g.stats.wins / g.stats.spins) * 100 : 0
  const net = g.stats.totalWon - g.stats.totalWagered

  return (
    <>
      <Header title="Профиль" right={<BalancePill />} />
      <div className="screen">
        <div className="pad">
          <div className="card center" style={{ marginBottom: 14 }}>
            <div className="avatar lg" style={{ margin: '0 auto 10px' }}>
              <Icon name="user" size={38} stroke={1.4} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Игрок MAX</div>
            <div className="muted" style={{ fontSize: 13 }}>{titleFor(lvl.lvl)} · уровень {lvl.lvl}</div>
            <div className="progress" style={{ marginTop: 12 }}>
              <i style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
            </div>
            <div className="muted mono" style={{ fontSize: 11.5, marginTop: 6 }}>
              {fmt(g.xp)} XP · до уровня {lvl.lvl + 1}: {fmt(lvl.next - g.xp)}
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat"><div className="v mono">{fmt(g.stats.spins)}</div><div className="l">Апгрейдов</div></div>
            <div className="stat"><div className="v mono">{winrate.toFixed(1)}%</div><div className="l">Винрейт</div></div>
            <div className="stat"><div className="v mono">x{g.stats.bestMult.toFixed(2)}</div><div className="l">Лучший множитель</div></div>
            <div className="stat"><div className="v mono">{fmt(g.stats.biggestWin)}</div><div className="l">Крупнейший выигрыш</div></div>
            <div className="stat"><div className="v mono">{fmt(g.stats.casesOpened)}</div><div className="l">Кейсов открыто</div></div>
            <div className="stat"><div className="v mono">{fmt(g.stats.totalWagered)}</div><div className="l">Всего прокручено</div></div>
            <div className="stat"><div className="v mono">{fmt(g.stats.maxBalance)}</div><div className="l">Рекорд баланса</div></div>
            <div className="stat">
              <div className="v mono" style={{ color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}
              </div>
              <div className="l">Профит по ставкам</div>
            </div>
          </div>

          <div className="sec-title">Игра</div>
          <div className="list">
            <button className="row" onClick={() => go({ s: 'ach' })}>
              <Icon name="trophy" size={20} className="row-ico" />
              <span className="t">Достижения</span>
              <span className="r">{g.achievements.length} / {ACHIEVEMENTS.length}</span>
            </button>
            <button className="row" onClick={() => go({ s: 'fair' })}>
              <Icon name="shield" size={20} className="row-ico" />
              <span className="t">Честная игра</span>
              <span className="r">раундов: {g.fair.nonce}</span>
            </button>
            <button className="row" onClick={() => { setPromoOpen(true); sfx.click() }}>
              <Icon name="ticket" size={20} className="row-ico" />
              <span className="t">Промокод</span>
              <span className="r">{g.promos.length} / {Object.keys(PROMOS).length}</span>
            </button>
          </div>

          <div className="sec-title">Настройки</div>
          <div className="list">
            <div className="row">
              <Icon name="theme" size={20} className="row-ico" />
              <span className="t">Тема</span>
              <span className="r">
                <span className="chips">
                  {(['auto', 'light', 'dark'] as const).map((t) => (
                    <button
                      key={t}
                      className={'chip' + (g.settings.theme === t ? ' on' : '')}
                      style={{ padding: '5px 10px', fontSize: 12 }}
                      onClick={() => g.setSettings({ theme: t })}
                    >{t === 'auto' ? 'Авто' : t === 'light' ? 'Светлая' : 'Тёмная'}</button>
                  ))}
                </span>
              </span>
            </div>
            <Toggle label="Звук" ico="sound" on={g.settings.sound} set={(v) => g.setSettings({ sound: v })} />
            <Toggle label="Вибрация" ico="vibrate" on={g.settings.haptics} set={(v) => g.setSettings({ haptics: v })} />
            <Toggle label="Быстрый режим" ico="bolt" on={g.settings.fastMode} set={(v) => g.setSettings({ fastMode: v })} />
            <Toggle label="Лента дропов" ico="megaphone" on={g.settings.showDrops} set={(v) => g.setSettings({ showDrops: v })} />
          </div>

          <div className="sec-title">Данные</div>
          <div className="list">
            <button className="row" onClick={() => { setSaveText(g.exportSave()); setSaveOpen(true) }}>
              <Icon name="save" size={20} className="row-ico" />
              <span className="t">Экспорт / импорт прогресса</span>
              <span className="r"><Icon name="chevron" size={16} /></span>
            </button>
            <button
              className="row"
              onClick={() => {
                if (confirm('Сбросить весь прогресс? Это необратимо.')) {
                  g.reset(); g.toast('Прогресс сброшен')
                }
              }}
            >
              <Icon name="reset" size={20} className="row-ico" style={{ color: 'var(--red)' }} />
              <span className="t" style={{ color: 'var(--red)' }}>Сбросить прогресс</span>
            </button>
          </div>

          <p className="muted center" style={{ fontSize: 11.5, padding: '22px 10px 0', lineHeight: 1.6 }}>
            MAX Upgrader v1.5 · игра на виртуальную валюту MX.<br />
            Реальных денег, покупок и вывода средств нет.
          </p>
        </div>
      </div>

      <Sheet open={promoOpen} onClose={() => setPromoOpen(false)} title="Промокод">
        <input
          className="field"
          placeholder="Введите код"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button
          className="btn"
          style={{ marginTop: 12 }}
          onClick={() => {
            const r = g.redeemPromo(code)
            g.toast(r.msg)
            if (r.ok) { sfx.coin(); setCode(''); setPromoOpen(false) }
          }}
        >Активировать</button>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12, lineHeight: 1.6 }}>
          Всего кодов: {Object.keys(PROMOS).length}. Активировано: {g.promos.length}.<br />
          Для старта: <b>MAX</b>, <b>UPGRADE</b>, <b>STICKER</b>, <b>LUCKY</b>, <b>CAT</b>.
        </p>
      </Sheet>

      <Sheet open={saveOpen} onClose={() => setSaveOpen(false)} title="Прогресс">
        <p className="muted" style={{ fontSize: 13 }}>
          Скопируй код, чтобы перенести прогресс на другое устройство, или вставь чужой и нажми «Импорт».
        </p>
        <textarea
          className="field mono"
          style={{ height: 130, fontSize: 11, marginTop: 8 }}
          value={saveText}
          onChange={(e) => setSaveText(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button
            className="btn ghost"
            onClick={() => { navigator.clipboard?.writeText(saveText); g.toast('Скопировано') }}
          >Копировать</button>
          <button
            className="btn"
            onClick={() => {
              if (g.importSave(saveText)) { g.toast('Прогресс загружен'); setSaveOpen(false) }
              else g.toast('Неверный код')
            }}
          >Импорт</button>
        </div>
      </Sheet>
    </>
  )
}

function Toggle({ label, ico, on, set }: { label: string; ico: IconName; on: boolean; set: (v: boolean) => void }) {
  return (
    <button className="row" onClick={() => set(!on)}>
      <Icon name={ico} size={20} className="row-ico" />
      <span className="t">{label}</span>
      <span className="r">
        <span className={'sw' + (on ? ' on' : '')}><i /></span>
      </span>
    </button>
  )
}
