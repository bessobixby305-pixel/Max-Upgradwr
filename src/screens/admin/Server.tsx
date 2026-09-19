import { useCallback, useEffect, useState } from 'react'
import { ItemCard, Sheet } from '../../components/ui'
import Icon from '../../components/Icon'
import { fmt, fmtShort } from '../../core/economy'
import { ITEM_BY_ID, sortedByPrice } from '../../core/items'
import { useGame } from '../../store/game'
import { serverCall, serverGet } from '../../lib/round'

interface Stats {
  users: number; banned: number; activeToday: number; roundsToday: number
  balanceTotal: number; wagered: number; won: number
  rtpAll: number | null; rtpDay: number | null
  top: { userId: string; login: string; banned: boolean; balance: number; level: number }[]
  recent: { id: string; login: string; game: string; bet: number; payout: number; at: number }[]
}
interface Player {
  userId: string; login: string; role: string; banned: boolean; banReason: string | null
  createdAt: number; lastSeenAt: number; balance: number; level: number
  items: number; rounds: number
}
interface Promo {
  id: string; code: string; amount: number; items: string[]
  maxUses: number | null; usedCount: number; perUserOnce: boolean
  expiresAt: number | null; revokedAt: number | null; note: string | null
}
interface LogEntry {
  id: string; admin: string; action: string; target: string | null
  payload: unknown; at: number
}

const GAME_NAME: Record<string, string> = {
  upgrade: 'Апгрейд', case: 'Кейс', dice: 'Кости', double: 'Дабл', slots: 'Слоты',
  contract: 'Контракт', wheel: 'Колесо', mines: 'Мины', tower: 'Башня', crash: 'Краш',
  battle: 'Битва', jackpot: 'Джекпот',
}
const ACTION_NAME: Record<string, string> = {
  claim: 'получил права', balance: 'изменил баланс', items: 'выдал предметы',
  ban: 'забанил', unban: 'разбанил', 'promo.create': 'создал код', 'promo.revoke': 'отозвал код',
}

const ago = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

type Tab = 'stats' | 'users' | 'promos' | 'log'

export default function ServerAdmin() {
  const toast = useGame((s) => s.toast)
  const [tab, setTab] = useState<Tab>('stats')
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<Player[]>([])
  const [promos, setPromos] = useState<Promo[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Player | null>(null)
  const [amount, setAmount] = useState('10000')
  const [note, setNote] = useState('')
  const [pickOpen, setPickOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // ——— новый промокод
  const [code, setCode] = useState('')
  const [pAmount, setPAmount] = useState('5000')
  const [pItems, setPItems] = useState<string[]>([])
  const [pUses, setPUses] = useState('')
  const [pHours, setPHours] = useState('')
  const [pickForCode, setPickForCode] = useState(false)

  const fail = (e: unknown) => toast((e as Error).message)

  const loadUsers = useCallback(async (query = '') => {
    try {
      const r = await serverGet<{ users: Player[] }>(`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      setUsers(r.users)
    } catch (e) { fail(e) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    (async () => {
      try {
        if (tab === 'stats') setStats(await serverGet<Stats>('/admin/stats'))
        if (tab === 'users') await loadUsers(q)
        if (tab === 'promos') setPromos((await serverGet<{ promos: Promo[] }>('/admin/promos')).promos)
        if (tab === 'log') setLog((await serverGet<{ entries: LogEntry[] }>('/admin/log')).entries)
      } catch (e) { fail(e) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const act = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try { await fn() } catch (e) { fail(e) } finally { setBusy(false) }
  }

  const num = (s: string) => Math.floor(Number(s.replace(/[^\d-]/g, '')) || 0)

  return (
    <>
      <div className="tabs-sticky" style={{ top: 'calc(var(--safe-top) + 132px)' }}>
        <div className="chips">
          {([['stats', 'Сводка'], ['users', 'Игроки'], ['promos', 'Коды'], ['log', 'Журнал']] as const).map(
            ([id, label]) => (
              <button key={id} className={'chip' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
                {label}
              </button>
            ),
          )}
        </div>
      </div>

      {/* ——————————————————————————————— сводка */}
      {tab === 'stats' && (stats ? (
        <>
          <div className="stat-grid">
            <div className="stat"><div className="v mono">{fmt(stats.users)}</div><div className="l">Игроков</div></div>
            <div className="stat"><div className="v mono">{fmt(stats.activeToday)}</div><div className="l">Активны за сутки</div></div>
            <div className="stat"><div className="v mono">{fmt(stats.roundsToday)}</div><div className="l">Раундов за сутки</div></div>
            <div className="stat"><div className="v mono">{fmtShort(stats.balanceTotal)}</div><div className="l">MX на руках</div></div>
            <div className="stat">
              <div className="v mono">{stats.rtpAll === null ? '—' : (stats.rtpAll * 100).toFixed(1) + '%'}</div>
              <div className="l">Отдача всего</div>
            </div>
            <div className="stat">
              <div className="v mono">{stats.rtpDay === null ? '—' : (stats.rtpDay * 100).toFixed(1) + '%'}</div>
              <div className="l">Отдача за сутки</div>
            </div>
          </div>

          <div className="sec-title">Богатейшие</div>
          <div className="list">
            {stats.top.map((u) => (
              <div className="row" key={u.userId}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">{u.login} {u.banned && '🚫'}</div>
                  <div className="s">уровень {u.level}</div>
                </span>
                <span className="r mono" style={{ fontWeight: 800, color: 'var(--text)' }}>{fmtShort(u.balance)}</span>
              </div>
            ))}
          </div>

          <div className="sec-title">Последние раунды</div>
          <div className="list">
            {stats.recent.map((r) => (
              <div className="row" key={r.id}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">{r.login}</div>
                  <div className="s">{GAME_NAME[r.game] ?? r.game} · {ago(r.at)}</div>
                </span>
                <span className="r mono" style={{ color: r.payout >= r.bet ? 'var(--green)' : 'var(--red)' }}>
                  {r.payout >= r.bet ? '+' : '−'}{fmtShort(Math.abs(r.payout - r.bet))}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : <div className="card center muted">Загружаем…</div>)}

      {/* ——————————————————————————————— игроки */}
      {tab === 'users' && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="field"
              placeholder="Поиск по логину"
              autoCapitalize="none"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void loadUsers(q) }}
            />
            <button className="btn sm" style={{ flex: 'none' }} onClick={() => void loadUsers(q)}>Найти</button>
          </div>

          <div className="list" style={{ marginTop: 12 }}>
            {users.map((u) => (
              <button className="row" key={u.userId} onClick={() => { setSel(u); setAmount('10000'); setNote('') }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">
                    {u.login}
                    {u.role === 'ADMIN' && <span style={{ color: 'var(--accent)' }}> · админ</span>}
                    {u.banned && <span style={{ color: 'var(--red)' }}> · бан</span>}
                  </div>
                  <div className="s">{ago(u.lastSeenAt)} · {u.rounds} раундов · {u.items} предметов</div>
                </span>
                <span className="r mono" style={{ fontWeight: 800, color: 'var(--text)' }}>{fmtShort(u.balance)}</span>
              </button>
            ))}
            {users.length === 0 && <div className="row muted">Никого не нашлось</div>}
          </div>
        </>
      )}

      {/* ——————————————————————————————— промокоды */}
      {tab === 'promos' && (
        <>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Новый код</div>
            <input
              className="field mono"
              placeholder="КОД"
              autoCapitalize="characters"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
            />
            <input
              className="field mono"
              style={{ marginTop: 8 }}
              inputMode="numeric"
              placeholder="сколько MX"
              value={pAmount}
              onChange={(e) => setPAmount(e.target.value.replace(/\D/g, ''))}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                className="field mono"
                inputMode="numeric"
                placeholder="активаций"
                value={pUses}
                onChange={(e) => setPUses(e.target.value.replace(/\D/g, ''))}
              />
              <input
                className="field mono"
                inputMode="numeric"
                placeholder="часов"
                value={pHours}
                onChange={(e) => setPHours(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <button
              className="btn ghost"
              style={{ marginTop: 8 }}
              onClick={() => { setPickForCode(true); setPickOpen(true) }}
            >{pItems.length ? `Предметов: ${pItems.length}` : 'Добавить предметы'}</button>
            {pItems.length > 0 && (
              <div className="chips" style={{ marginTop: 8 }}>
                {pItems.map((id, i) => (
                  <button
                    key={id + i}
                    className="chip"
                    onClick={() => setPItems(pItems.filter((_, k) => k !== i))}
                  >{ITEM_BY_ID[id]?.emo} ✕</button>
                ))}
              </div>
            )}
            <button
              className="btn"
              style={{ marginTop: 12 }}
              disabled={busy || code.length < 3 || (!num(pAmount) && !pItems.length)}
              onClick={() => void act(async () => {
                await serverCall('/admin/promos', {
                  code,
                  amount: num(pAmount),
                  items: pItems,
                  maxUses: pUses ? num(pUses) : null,
                  expiresInHours: pHours ? num(pHours) : null,
                })
                toast(`Код ${code} создан`)
                setCode(''); setPItems([]); setPUses(''); setPHours('')
                setPromos((await serverGet<{ promos: Promo[] }>('/admin/promos')).promos)
              })}
            >Создать код</button>
            <p className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.55 }}>
              Пустые поля «активаций» и «часов» означают без ограничений.
              Такой код можно отозвать в любой момент — в отличие от оффлайновых.
            </p>
          </div>

          <div className="sec-title">Выпущенные · {promos.length}</div>
          <div className="list">
            {promos.map((p) => (
              <div className="row" key={p.id} style={{ opacity: p.revokedAt ? .5 : 1 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div className="t mono">{p.code}</div>
                  <div className="s">
                    {p.amount > 0 && `${fmt(p.amount)} MX`}
                    {p.amount > 0 && p.items.length > 0 && ' · '}
                    {p.items.map((id) => ITEM_BY_ID[id]?.emo).join('')}
                    {' · '}
                    {p.usedCount}{p.maxUses ? `/${p.maxUses}` : ''} активаций
                    {p.revokedAt && ' · отозван'}
                    {!p.revokedAt && p.expiresAt && p.expiresAt < Date.now() && ' · истёк'}
                  </div>
                </span>
                {!p.revokedAt && (
                  <button
                    className="icon-btn"
                    aria-label="Отозвать"
                    onClick={() => void act(async () => {
                      await serverCall(`/admin/promos/${p.id}/revoke`)
                      toast(`Код ${p.code} отозван`)
                      setPromos((await serverGet<{ promos: Promo[] }>('/admin/promos')).promos)
                    })}
                  ><Icon name="close" size={18} style={{ color: 'var(--red)' }} /></button>
                )}
              </div>
            ))}
            {promos.length === 0 && <div className="row muted">Кодов пока нет</div>}
          </div>
        </>
      )}

      {/* ——————————————————————————————— журнал */}
      {tab === 'log' && (
        <div className="list">
          {log.map((e) => (
            <div className="row" key={e.id}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div className="t">
                  {e.admin} {ACTION_NAME[e.action] ?? e.action}{e.target ? ` · ${e.target}` : ''}
                </div>
                <div className="s mono" style={{ fontSize: 11.5 }}>
                  {ago(e.at)}{e.payload ? ' · ' + JSON.stringify(e.payload) : ''}
                </div>
              </span>
            </div>
          ))}
          {log.length === 0 && <div className="row muted">Журнал пуст</div>}
        </div>
      )}

      {/* ——————————————————————————————— карточка игрока */}
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.login}>
        {sel && (
          <>
            <div className="stat-grid" style={{ marginBottom: 14 }}>
              <div className="stat"><div className="v mono">{fmtShort(sel.balance)}</div><div className="l">Баланс</div></div>
              <div className="stat"><div className="v mono">{sel.level}</div><div className="l">Уровень</div></div>
              <div className="stat"><div className="v mono">{fmt(sel.rounds)}</div><div className="l">Раундов</div></div>
              <div className="stat"><div className="v mono">{fmt(sel.items)}</div><div className="l">Предметов</div></div>
            </div>

            <input
              className="field mono"
              inputMode="numeric"
              placeholder="сумма, минус — списать"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d-]/g, ''))}
            />
            <input
              className="field"
              style={{ marginTop: 8 }}
              placeholder="за что (в журнал)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="chips" style={{ margin: '10px 0' }}>
              {['1000', '10000', '100000', '1000000', '-10000'].map((v) => (
                <button key={v} className="chip mono" onClick={() => setAmount(v)}>
                  {v.startsWith('-') ? '−' + fmt(-Number(v)) : fmt(+v)}
                </button>
              ))}
            </div>
            <button
              className="btn"
              disabled={busy || !num(amount)}
              onClick={() => void act(async () => {
                const r = await serverCall<{ balance: number; applied: number }>(
                  `/admin/users/${sel.userId}/balance`, { amount: num(amount), note: note || undefined },
                )
                toast(`${sel.login}: ${r.applied >= 0 ? '+' : '−'}${fmt(Math.abs(r.applied))} MX`)
                setSel({ ...sel, balance: r.balance })
                await loadUsers(q)
              })}
            >Применить к балансу</button>

            <button
              className="btn ghost"
              style={{ marginTop: 8 }}
              onClick={() => { setPickForCode(false); setPickOpen(true) }}
            >Выдать предмет</button>

            <button
              className="btn"
              style={{ marginTop: 8, background: sel.banned ? 'var(--green)' : 'var(--red)' }}
              disabled={busy}
              onClick={() => void act(async () => {
                const reason = sel.banned ? undefined : prompt('Причина бана?') ?? undefined
                await serverCall(`/admin/users/${sel.userId}/ban`, { banned: !sel.banned, reason })
                toast(sel.banned ? `${sel.login} разбанен` : `${sel.login} забанен`)
                setSel({ ...sel, banned: !sel.banned })
                await loadUsers(q)
              })}
            >{sel.banned ? 'Разбанить' : 'Забанить'}</button>

            {sel.banned && sel.banReason && (
              <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Причина: {sel.banReason}</p>
            )}
          </>
        )}
      </Sheet>

      {/* ——————————————————————————————— выбор предмета */}
      <Sheet
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        title={pickForCode ? 'Добавить в код' : 'Выдать предмет'}
      >
        <div className="grid">
          {sortedByPrice.map((it) => (
            <ItemCard
              key={it.id}
              id={it.id}
              onClick={() => {
                if (pickForCode) {
                  setPItems((x) => [...x, it.id])
                  setPickOpen(false)
                  return
                }
                if (!sel) return
                setPickOpen(false)
                void act(async () => {
                  await serverCall(`/admin/users/${sel.userId}/items`, { items: [it.id] })
                  toast(`${sel.login}: ${it.emo} ${it.name}`)
                  setSel({ ...sel, items: sel.items + 1 })
                })
              }}
            />
          ))}
        </div>
      </Sheet>
    </>
  )
}
