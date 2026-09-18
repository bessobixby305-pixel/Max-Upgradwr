import { Header } from '../components/ui'
import ResultCard from '../components/ResultCard'
import { useGame } from '../store/game'

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

export default function DropsChannel({ onBack }: { onBack: () => void }) {
  const drops = useGame((s) => s.messages.filter((m) => m.chat === 'drops')).slice().reverse()
  const showDrops = useGame((s) => s.settings.showDrops)
  const setSettings = useGame((s) => s.setSettings)

  return (
    <>
      <Header
        title="Дропы MAX"
        sub={`канал · ${(12400 + drops.length * 7).toLocaleString('ru-RU')} подписчиков`}
        onBack={onBack}
        right={
          <button className="chip" onClick={() => setSettings({ showDrops: !showDrops })}>
            {showDrops ? '🔔' : '🔕'}
          </button>
        }
      />
      <div className="screen" style={{ background: 'var(--bg-chat)' }}>
        <div className="pad">
          {drops.map((m) => (
            <div className="post" key={m.id}>
              <div className="ph">
                <div className="avatar sm">{m.author?.emo ?? '🎲'}</div>
                <div className="pn">{m.author?.name ?? 'Игрок'}</div>
                <div className="pt">{time(m.ts)} · 👁 {(120 + ((m.ts / 7) % 900) | 0)}</div>
              </div>
              {m.result && <ResultCard r={m.result} />}
            </div>
          ))}
          {!drops.length && (
            <div className="center muted" style={{ padding: 40 }}>Пока пусто</div>
          )}
        </div>
      </div>
    </>
  )
}
