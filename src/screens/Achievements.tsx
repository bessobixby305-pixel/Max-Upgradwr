import { Header } from '../components/ui'
import { ACHIEVEMENTS, fmt } from '../core/economy'
import { useGame } from '../store/game'

export default function Achievements({ onBack }: { onBack: () => void }) {
  const done = useGame((s) => s.achievements)
  const reward = ACHIEVEMENTS.filter((a) => done.includes(a.id)).reduce((s, a) => s + a.reward, 0)

  return (
    <>
      <Header
        title="Достижения"
        sub={`${done.length} из ${ACHIEVEMENTS.length} · получено ${fmt(reward)} MX`}
        onBack={onBack}
      />
      <div className="screen">
        <div className="pad">
          <div className="progress" style={{ marginBottom: 14 }}>
            <i style={{ width: `${(done.length / ACHIEVEMENTS.length) * 100}%` }} />
          </div>
          <div className="list">
            {ACHIEVEMENTS.map((a) => {
              const got = done.includes(a.id)
              return (
                <div className="row" key={a.id} style={{ opacity: got ? 1 : 0.55 }}>
                  <span style={{ fontSize: 26, filter: got ? undefined : 'grayscale(1)' }}>{a.emo}</span>
                  <span style={{ flex: 1 }}>
                    <div className="t">{a.name}</div>
                    <div className="s">{a.desc}</div>
                  </span>
                  <span className="r mono" style={{ color: got ? 'var(--green)' : undefined }}>
                    {got ? '✓' : `+${fmt(a.reward)}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
