import { Route } from '../App'
import { Sheet } from './ui'
import Icon from './Icon'
import {
  DAILY_COOLDOWN, PROMOS, WHEEL_COOLDOWN, dailyReward, fmt,
} from '../core/economy'
import { useGame } from '../store/game'
import { onlineMode, serverCall } from '../lib/round'
import { sfx } from '../lib/fx'

/** Бонусы под кнопкой «+» в шапке: дейлик, колесо, промокоды. */
export default function BonusSheet({
  open, onClose, go,
}: { open: boolean; onClose: () => void; go: (r: Route) => void }) {
  const g = useGame()
  // онлайн кулдауны держит сервер: он и ответит, если рано
  const online = onlineMode()
  const dailyReady = online || Date.now() - g.daily.last >= DAILY_COOLDOWN
  const wheelReady = online || Date.now() - g.wheelLast >= WHEEL_COOLDOWN
  const nextStreak = Math.min(g.daily.streak + 1, 7)

  return (
    <Sheet open={open} onClose={onClose} title="Бонусы">
      <div className="list">
        <button
          className="row"
          disabled={!dailyReady}
          style={{ opacity: dailyReady ? 1 : .5 }}
          onClick={async () => {
            onClose()
            if (!online) {
              const r = g.claimDaily()
              if (r) { sfx.coin(); g.toast(`+${fmt(r)} MX · день ${g.daily.streak}`) }
              return
            }
            try {
              const r = await serverCall<{ amount: number; streak: number; balance: number }>('/bonus/daily')
              g.setServerState({ balance: r.balance, xp: g.xp })
              g.markDaily(r.streak)
              sfx.coin()
              g.toast(`+${fmt(r.amount)} MX · день ${r.streak}`)
            } catch (e) {
              g.toast((e as Error).message)
            }
          }}
        >
          <Icon name="gift" size={20} className="row-ico" />
          <span style={{ flex: 1 }}>
            <div className="t">Ежедневный бонус</div>
            <div className="s">
              {dailyReady ? `+${fmt(dailyReward(nextStreak))} MX · день ${nextStreak}` : 'уже забран, приходи завтра'}
            </div>
          </span>
        </button>

        <button className="row" onClick={() => { onClose(); go({ s: 'wheel' }) }}>
          <Icon name="wheel" size={20} className="row-ico" />
          <span style={{ flex: 1 }}>
            <div className="t">Колесо дня</div>
            <div className="s">{wheelReady ? 'бесплатный спин готов' : 'следующий через 8 ч'}</div>
          </span>
          <span className="r"><Icon name="chevron" size={16} /></span>
        </button>

        <button className="row" onClick={() => { onClose(); go({ s: 'profile' }) }}>
          <Icon name="ticket" size={20} className="row-ico" />
          <span style={{ flex: 1 }}>
            <div className="t">Промокоды</div>
            <div className="s">активировано {g.promos.length} из {Object.keys(PROMOS).length}</div>
          </span>
          <span className="r"><Icon name="chevron" size={16} /></span>
        </button>

        {g.balance <= 50 && (
          <button
            className="row"
            onClick={async () => {
              onClose()
              if (!online) {
                if (g.claimRescue()) { sfx.coin(); g.toast('+100 MX') }
                else g.toast('Ещё рано, подожди немного')
                return
              }
              try {
                const r = await serverCall<{ amount: number; balance: number }>('/bonus/rescue')
                g.setServerState({ balance: r.balance, xp: g.xp })
                sfx.coin()
                g.toast(`+${fmt(r.amount)} MX`)
              } catch (e) {
                g.toast((e as Error).message)
              }
            }}
          >
            <Icon name="reset" size={20} className="row-ico" />
            <span style={{ flex: 1 }}>
              <div className="t">Спасательный круг</div>
              <div className="s">100 MX раз в 15 минут при нулевом балансе</div>
            </span>
          </button>
        )}
      </div>
    </Sheet>
  )
}
