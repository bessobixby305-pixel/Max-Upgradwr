import { useState } from 'react'
import { Header } from '../components/ui'
import { hmacSha256Hex, rollFloat, sha256Hex } from '../core/fair'
import { fmt } from '../core/economy'
import { useGame } from '../store/game'

export default function Fairness({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [cs, setCs] = useState(g.fair.clientSeed)
  const [vSeed, setVSeed] = useState('')
  const [vClient, setVClient] = useState('')
  const [vNonce, setVNonce] = useState('1')
  const [res, setRes] = useState<string | null>(null)

  const verify = () => {
    const seed = vSeed.trim()
    const client = vClient.trim()
    const n = parseInt(vNonce, 10) || 0
    if (!seed || !client) { setRes('Заполните сид и клиентский сид'); return }
    const roll = rollFloat(seed, client, n)
    setRes(
      `SHA256(серверного сида) = ${sha256Hex(seed)}\n\n` +
      `HMAC = ${hmacSha256Hex(seed, `${client}:${n}:0`).slice(0, 32)}…\n\n` +
      `Результат раунда: ${roll.toFixed(8)}  (${(roll * 100).toFixed(4)}%)`,
    )
  }

  return (
    <>
      <Header title="Честная игра" sub="provably fair" onBack={onBack} />
      <div className="screen">
        <div className="pad">
          <div className="card" style={{ marginBottom: 14 }}>
            <b>Как это работает</b>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 0 }}>
              До игры приложение фиксирует серверный сид и показывает его SHA-256 хэш.
              Результат раунда = HMAC-SHA256(серверный сид, «клиентский сид : номер раунда»),
              первые 8 hex-символов делятся на 2³². Подменить результат после ставки нельзя:
              изменится хэш. Клиентский сид вы задаёте сами.
            </p>
          </div>

          <div className="sec-title">Текущая цепочка</div>
          <div className="list">
            <div className="row" style={{ display: 'block' }}>
              <div className="s">Хэш серверного сида</div>
              <div className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{g.fair.serverSeedHash}</div>
            </div>
            <div className="row">
              <span className="t">Раундов сыграно</span>
              <span className="r mono">{g.fair.nonce}</span>
            </div>
            <div className="row" style={{ display: 'block' }}>
              <div className="s" style={{ marginBottom: 6 }}>Клиентский сид</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="field mono" style={{ fontSize: 13 }} value={cs} onChange={(e) => setCs(e.target.value)} />
                <button
                  className="btn sm"
                  onClick={() => { g.setClientSeed(cs); g.toast('Сиды обновлены, старый раскрыт') }}
                >Сменить</button>
              </div>
            </div>
          </div>

          {g.fair.revealed && (
            <>
              <div className="sec-title">Раскрытая прошлая цепочка</div>
              <div className="list">
                <div className="row" style={{ display: 'block' }}>
                  <div className="s">Серверный сид</div>
                  <div className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{g.fair.revealed.serverSeed}</div>
                </div>
                <div className="row" style={{ display: 'block' }}>
                  <div className="s">Его хэш (сверьте с тем, что видели раньше)</div>
                  <div className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{g.fair.revealed.hash}</div>
                </div>
                <div className="row">
                  <span className="t">Клиентский сид</span>
                  <span className="r mono" style={{ fontSize: 11 }}>{g.fair.revealed.clientSeed}</span>
                </div>
                <div className="row">
                  <span className="t">Раундов</span>
                  <span className="r mono">{g.fair.revealed.rounds}</span>
                </div>
              </div>
            </>
          )}

          <div className="sec-title">Калькулятор проверки</div>
          <div className="card">
            <input className="field mono" style={{ fontSize: 12, marginBottom: 8 }} placeholder="серверный сид" value={vSeed} onChange={(e) => setVSeed(e.target.value)} />
            <input className="field mono" style={{ fontSize: 12, marginBottom: 8 }} placeholder="клиентский сид" value={vClient} onChange={(e) => setVClient(e.target.value)} />
            <input className="field mono" style={{ fontSize: 12, marginBottom: 12 }} placeholder="номер раунда" inputMode="numeric" value={vNonce} onChange={(e) => setVNonce(e.target.value.replace(/\D/g, ''))} />
            <button className="btn" onClick={verify}>Проверить</button>
            {res && (
              <pre className="mono" style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: 0 }}>{res}</pre>
            )}
          </div>

          <div className="sec-title">История раундов</div>
          <div className="list">
            {g.rounds.slice(0, 40).map((r, i) => (
              <div className="row" key={i}>
                <span className="mono muted" style={{ width: 42 }}>#{r.n}</span>
                <span style={{ flex: 1 }}>
                  <div className="t" style={{ fontSize: 13.5 }}>{r.kind}</div>
                  <div className="s mono">
                    roll {r.roll.toFixed(6)}{r.chance !== undefined && ` · шанс ${(r.chance * 100).toFixed(2)}%`}
                  </div>
                </span>
                <span className="r mono" style={{ color: r.win ? 'var(--green)' : 'var(--red)' }}>
                  {r.win ? '+' + fmt(r.payout) : '—'}
                </span>
              </div>
            ))}
            {!g.rounds.length && <div className="row muted">Пока нет раундов</div>}
          </div>
        </div>
      </div>
    </>
  )
}
