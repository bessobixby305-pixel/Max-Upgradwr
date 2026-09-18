import { Route } from '../App'
import { BalancePill, Header } from '../components/ui'
import { fmt } from '../core/economy'
import { ITEM_BY_ID } from '../core/items'
import Icon from '../components/Icon'
import { useGame } from '../store/game'

const timeOf = (ts: number) =>
  new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

export default function Chats({ go }: { go: (r: Route) => void }) {
  const messages = useGame((s) => s.messages)
  const botMsgs = messages.filter((m) => m.chat === 'bot')
  const drops = messages.filter((m) => m.chat === 'drops')
  const last = botMsgs[botMsgs.length - 1]
  const lastDrop = drops[drops.length - 1]

  const preview = (() => {
    if (!last) return 'Нажми, чтобы начать игру'
    if (last.text) return last.text
    const r = last.result!
    return `${r.title} · ${r.payout > 0 ? '+' + fmt(r.payout) : '−' + fmt(r.bet)} MX`
  })()

  const dropPreview = lastDrop?.result
    ? `${lastDrop.author?.name}: ${lastDrop.result.itemId ? ITEM_BY_ID[lastDrop.result.itemId]?.name : lastDrop.result.title}`
    : 'Лента выигрышей'

  return (
    <>
      <Header title="Чаты" right={<BalancePill />} />
      <div className="screen">
        <div className="pad">
          <div className="list">
            <button className="row" onClick={() => go({ s: 'chatBot' })}>
              <div className="avatar acc"><Icon name="games" size={21} /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="t" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  MAX Upgrader Bot
                  <span className="verified" title="Проверенный"><Icon name="check" size={9} stroke={3.4} /></span>
                </div>
                <div className="s" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {preview}
                </div>
              </div>
              <div className="r" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                <span>{last ? timeOf(last.ts) : ''}</span>
                {botMsgs.length > 0 && (
                  <span className="badge-pill">{botMsgs.length > 99 ? '99+' : botMsgs.length}</span>
                )}
              </div>
            </button>

            <button className="row" onClick={() => go({ s: 'drops' })}>
              <div className="avatar"><Icon name="megaphone" size={20} /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="t">Дропы MAX</div>
                <div className="s" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dropPreview}
                </div>
              </div>
              <div className="r">{lastDrop ? timeOf(lastDrop.ts) : ''}</div>
            </button>

            <button className="row" onClick={() => go({ s: 'fair' })}>
              <div className="avatar"><Icon name="shield" size={20} /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="t">Честная игра</div>
                <div className="s">Проверка результатов и сидов</div>
              </div>
              <div className="r"><Icon name="chevron" size={16} /></div>
            </button>
          </div>

          <div className="sec-title">Закреплённое</div>
          <div className="list">
            <button className="row" onClick={() => go({ s: 'upgrade' })}>
              <div className="avatar sm"><Icon name="games" size={17} /></div>
              <div className="t">Открыть апгрейдер</div>
              <div className="r"><Icon name="chevron" size={16} /></div>
            </button>
            <button className="row" onClick={() => go({ s: 'wheel' })}>
              <div className="avatar sm"><Icon name="wheel" size={17} /></div>
              <div className="t">Колесо дня</div>
              <div className="r"><Icon name="chevron" size={16} /></div>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
