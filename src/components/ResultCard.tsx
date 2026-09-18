import { GameResult } from '../store/game'
import { ITEM_BY_ID } from '../core/items'
import { fmt } from '../core/economy'

const KIND_EMO: Record<string, string> = {
  upgrade: '🎰', case: '📦', mines: '💣', crash: '🚀',
  contract: '📝', battle: '⚔️', bonus: '🎁',
  dice: '🎲', double: '🔴', tower: '🗼', slots: '🎰', jackpot: '🏦',
}

export default function ResultCard({ r }: { r: GameResult }) {
  const win = r.payout > 0
  const item = r.itemId ? ITEM_BY_ID[r.itemId] : undefined
  const net = r.payout - r.bet
  return (
    <div className="res-card">
      <div className="ttl">
        <span>{KIND_EMO[r.kind] ?? '🎲'}</span>
        <span>{r.title}</span>
      </div>
      {r.bet > 0 && (
        <div className="kv"><span>Ставка</span><span className="mono">{fmt(r.bet)} MX</span></div>
      )}
      {r.chance !== undefined && (
        <div className="kv"><span>Шанс</span><span className="mono">{(r.chance * 100).toFixed(2)}%</span></div>
      )}
      {r.extra && <div className="kv"><span>{r.extra}</span></div>}
      {item && (
        <div className="kv" style={{ marginTop: 4 }}>
          <span>{item.emo} {item.name}</span>
          <span className="mono">{fmt(item.price)}</span>
        </div>
      )}
      <div className={'out-line ' + (win ? 'win' : 'lose')}>
        {win ? `+${fmt(r.payout)} MX` : `−${fmt(r.bet)} MX`}
        {r.bet > 0 && win && (
          <span className="mono" style={{ fontWeight: 600, fontSize: 12, opacity: .75 }}>
            {'  '}({net >= 0 ? '+' : '−'}{fmt(Math.abs(net))} чистыми)
          </span>
        )}
      </div>
    </div>
  )
}
