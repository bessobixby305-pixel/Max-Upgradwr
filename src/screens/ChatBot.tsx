import { useEffect, useRef } from 'react'
import { Route } from '../App'
import { BalancePill, Header } from '../components/ui'
import ResultCard from '../components/ResultCard'
import { useGame } from '../store/game'

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

const dayKey = (ts: number) => new Date(ts).toDateString()
const dayLabel = (ts: number) => {
  const d = new Date(ts)
  const today = new Date()
  const y = new Date(Date.now() - 864e5)
  if (d.toDateString() === today.toDateString()) return 'Сегодня'
  if (d.toDateString() === y.toDateString()) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export default function ChatBot({ onBack, go }: { onBack: () => void; go: (r: Route) => void }) {
  const messages = useGame((s) => s.messages.filter((m) => m.chat === 'bot'))
  const clearChat = useGame((s) => s.clearChat)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  let lastDay = ''

  return (
    <>
      <Header
        title="MAX Upgrader Bot"
        sub="бот · онлайн"
        onBack={onBack}
        right={
          <>
            <BalancePill />
            <button className="icon-btn" onClick={clearChat} title="Очистить" aria-label="Очистить">🗑</button>
          </>
        }
      />
      <div className="chat-wrap">
        {!messages.length && (
          <div className="center muted" style={{ margin: 'auto', padding: 30, fontSize: 14 }}>
            Здесь появятся результаты игр.<br />Каждый раунд приходит сообщением.
          </div>
        )}
        {messages.map((m) => {
          const dk = dayKey(m.ts)
          const sep = dk !== lastDay ? ((lastDay = dk), dayLabel(m.ts)) : null
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {sep && <div className="day-sep">{sep}</div>}
              <div className={'bub ' + (m.out ? 'out' : 'in')}>
                {m.result ? <ResultCard r={m.result} /> : m.text}
                <span className="meta">{time(m.ts)}{m.out && ' ✓✓'}</span>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 12px calc(10px + var(--safe-bottom))',
        background: 'var(--bg)', borderTop: '1px solid var(--sep)', display: 'flex', gap: 8,
        maxWidth: 560, margin: '0 auto',
      }}>
        <button className="btn sm ghost grow" onClick={() => go({ s: 'upgrade' })}>🎰 Апгрейд</button>
        <button className="btn sm ghost grow" onClick={() => go({ s: 'cases' })}>📦 Кейсы</button>
        <button className="btn sm grow" onClick={() => go({ s: 'wheel' })}>🎁 Бонус</button>
      </div>
    </>
  )
}
