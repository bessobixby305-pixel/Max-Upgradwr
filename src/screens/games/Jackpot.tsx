import { useCallback, useEffect, useRef, useState } from 'react'
import { BalancePill, BetInput, Header } from '../../components/ui'
import { fmt, fmtShort } from '../../core/economy'
import { useGame } from '../../store/game'
import { localRng, onlineMode, serverCall, serverGet } from '../../lib/round'
import { confetti, haptic, sfx, wait } from '../../lib/fx'

const RAKE = 0.08
const NAMES = ['Артём_max', 'Ника228', 'Тимур_pro', 'Соня🍀', 'Денис_off', 'Влад ЪУЪ', 'Катя_чат', 'Гоша2010']
const EMOS = ['🐱', '🐼', '🦊', '🐸', '👾', '🎧', '🐝', '🍕']
const COLORS = ['#7B61FF', '#4E8CFF', '#1E9E52', '#C98411', '#C7467E', '#12938D', '#D94437', '#8557CE']

interface Entry { id: string; name: string; emo: string; bot: boolean; me: boolean; bet: number; share: number }
interface Room {
  id: string
  status: 'open' | 'done'
  pot: number
  rake: number
  prize: number
  closesAt: number | null
  now: number
  winnerName: string | null
  winnerShare: number | null
  fair: { serverSeedHash: string; serverSeed: string | null; roll: number | null }
  entries: Entry[]
}

const POLL = 1200
const SPIN_MS = 4200
const R = 52
const CIRC = 2 * Math.PI * R

export default function Jackpot({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const online = onlineMode()
  const [bet, setBet] = useState(500)
  const [room, setRoom] = useState<Room | null>(null)
  const [last, setLast] = useState<Room | null>(null)
  const [angle, setAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [reveal, setReveal] = useState<Room | null>(null)
  const [busy, setBusy] = useState(false)
  /** разница между часами телефона и сервера — иначе отсчёт врёт */
  const drift = useRef(0)
  const [, tick] = useState(0)
  const shownRound = useRef<string | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  const maxBet = Math.max(1, Math.floor(g.balance))
  const shown = reveal ?? room
  const entries = shown?.entries ?? []
  const pot = shown?.pot ?? 0

  // ——— опрос комнаты
  const pull = useCallback(async () => {
    if (!online) return
    try {
      const r = await serverGet<{ room: Room; last: Room | null }>('/jackpot')
      drift.current = r.room.now - Date.now()
      setRoom(r.room)
      if (r.last && r.last.id !== shownRound.current) setLast(r.last)
    } catch { /* повторим на следующем круге */ }
  }, [online])

  useEffect(() => {
    if (!online) return
    void pull()
    const t = setInterval(() => void pull(), POLL)
    return () => clearInterval(t)
  }, [online, pull])

  // секундная стрелка для обратного отсчёта
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 250)
    return () => clearInterval(t)
  }, [])

  // ——— показываем розыгрыш прошлой комнаты
  useEffect(() => {
    if (!last || spinning || shownRound.current === last.id) return
    shownRound.current = last.id
    void runSpin(last)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last])

  async function runSpin(result: Room) {
    setReveal(result)
    setSpinning(true)
    sfx.click()

    // стрелка встаёт в середину сектора победителя
    const idx = result.entries.findIndex((e) => e.name === result.winnerName)
    let start = 0
    for (let i = 0; i < idx; i++) start += result.entries[i].share
    const center = (start + (result.entries[idx]?.share ?? 0) / 2) * 360

    setAngle((a) => a + 360 * 5 + ((center - ((a % 360) + 360) % 360) + 360) % 360)

    let t = 0
    const tk = () => {
      if (t > SPIN_MS) return
      sfx.tick()
      const k = t / SPIN_MS
      t += 50 + k * k * 470
      setTimeout(tk, 50 + k * k * 470)
    }
    tk()
    await wait(SPIN_MS + 250)

    const mine = result.entries.find((e) => e.me)
    const won = !!mine && result.winnerName === mine.name
    if (won) {
      confetti(hostRef.current, 170)
      sfx.bigWin()
      haptic([0, 50, 60, 50])
    } else if (mine) {
      sfx.lose()
      haptic(140)
    }
    if (mine) {
      g.pushResult({
        kind: 'jackpot',
        title: 'Джекпот',
        bet: mine.bet,
        payout: won ? result.prize : 0,
        chance: mine.share,
        extra: won ? 'забрал банк' : `победил ${result.winnerName}`,
      })
    }
    setSpinning(false)
    await wait(2600)
    setReveal(null)
    void pull()
  }

  async function join() {
    if (busy || spinning) return
    setBusy(true)
    try {
      if (online) {
        const r = await serverCall<{ room: Room; balance: number; xp: number }>('/jackpot/join', { bet })
        g.setServerState({ balance: r.balance, xp: r.xp })
        setRoom(r.room)
        sfx.coin()
      } else {
        await playOffline()
      }
    } catch (e) {
      g.toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  /** Офлайн: комната собирается прямо здесь, соперники — боты. */
  async function playOffline() {
    if (!g.bet(bet)) throw new Error('Недостаточно MX')
    const rng = localRng()
    const pool = NAMES.slice().sort(() => Math.random() - 0.5)
    const list: Entry[] = [
      { id: 'me', name: 'Ты', emo: '🦄', bot: false, me: true, bet, share: 0 },
      ...[...Array(3)].map((_, i) => ({
        id: 'b' + i,
        name: pool[i],
        emo: EMOS[i % EMOS.length],
        bot: true,
        me: false,
        bet: Math.max(10, Math.round(bet * (0.3 + rng.roll(50 + i) * 2.2))),
        share: 0,
      })),
    ]
    const total = list.reduce((s, e) => s + e.bet, 0)
    for (const e of list) e.share = e.bet / total

    const roll = rng.roll()
    let acc = 0
    let winner = list[list.length - 1]
    for (const e of list) {
      acc += e.share
      if (roll < acc) { winner = e; break }
    }
    const prize = Math.round(total * (1 - RAKE))
    if (winner.me) {
      g.win(prize)
      g.bumpStats({ wins: g.stats.wins + 1, jackpotWins: g.stats.jackpotWins + 1 })
    } else {
      g.bumpStats({ losses: g.stats.losses + 1 })
    }
    g.bumpStats({ spins: g.stats.spins + 1 })
    g.checkAchievements()

    shownRound.current = null
    await runSpin({
      id: 'offline', status: 'done', pot: total, rake: RAKE, prize,
      closesAt: null, now: Date.now(),
      winnerName: winner.name, winnerShare: winner.share,
      fair: { serverSeedHash: '', serverSeed: null, roll },
      entries: list,
    })
  }

  const mine = entries.find((e) => e.me)
  const left = room?.closesAt ? Math.max(0, room.closesAt - (Date.now() + drift.current)) : 0
  const secs = Math.ceil(left / 1000)

  // дуги кольца: каждому участнику свой сектор
  let offset = 0
  const arcs = entries.map((e, i) => {
    const dash = e.share * CIRC
    const seg = { key: e.id, color: COLORS[i % COLORS.length], dash, offset }
    offset += dash
    return seg
  })

  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header
        title="Джекпот"
        sub={online ? 'общий банк на всех' : 'офлайн: против ботов'}
        onBack={onBack}
        right={<BalancePill />}
      />
      <div className="screen has-action-bar">
        <div className="pad">
          <div className="jp-ring">
            <svg viewBox="0 0 130 130" className="jp-svg">
              <circle className="jp-track" cx="65" cy="65" r={R} />
              {arcs.map((a) => (
                <circle
                  key={a.key}
                  className="jp-arc"
                  cx="65" cy="65" r={R}
                  stroke={a.color}
                  strokeDasharray={`${a.dash} ${CIRC - a.dash}`}
                  strokeDashoffset={-a.offset}
                />
              ))}
            </svg>

            <div
              className="jp-needle"
              style={{
                transform: `rotate(${angle}deg)`,
                transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.12,.72,.1,1)` : 'none',
              }}
            >
              <i />
            </div>

            <div className="jp-center">
              {reveal ? (
                <>
                  <div className="jp-label">{spinning ? 'крутим' : 'победил'}</div>
                  <div className="jp-value">{spinning ? '…' : reveal.winnerName}</div>
                  {!spinning && (
                    <div className="jp-sub mono" style={{ color: 'var(--green)' }}>+{fmtShort(reveal.prize)}</div>
                  )}
                </>
              ) : (
                <>
                  <div className="jp-label">в банке</div>
                  <div className="jp-value mono">{fmtShort(pot)}</div>
                  <div className="jp-sub mono">
                    {room?.closesAt ? `${secs} с` : entries.length ? 'ждём' : 'пусто'}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="jp-stats">
            <div className="stat">
              <div className="v mono">{entries.length}</div>
              <div className="l">Участников</div>
            </div>
            <div className="stat">
              <div className="v mono" style={{ color: 'var(--green)' }}>{fmtShort(shown?.prize ?? 0)}</div>
              <div className="l">Приз</div>
            </div>
            <div className="stat">
              <div className="v mono">{mine ? (mine.share * 100).toFixed(1) + '%' : '—'}</div>
              <div className="l">Твой шанс</div>
            </div>
          </div>

          {entries.length > 0 ? (
            <div className="list" style={{ marginTop: 14 }}>
              {entries.map((e, i) => (
                <div
                  key={e.id}
                  className={'row jp-row' + (reveal && !spinning && reveal.winnerName === e.name ? ' win' : '')}
                >
                  <span className="jp-dot" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="avatar sm" style={{ fontSize: 17 }}>{e.emo}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">{e.me ? 'Ты' : e.name}</div>
                    <div className="s mono">{fmt(e.bet)} MX</div>
                  </span>
                  <span className="r mono" style={{ fontWeight: 800, color: 'var(--text)' }}>
                    {(e.share * 100).toFixed(1)}%
                  </span>
                  <i className="jp-bar" style={{ width: `${e.share * 100}%`, background: COLORS[i % COLORS.length] }} />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted center" style={{ fontSize: 13, marginTop: 18, lineHeight: 1.6 }}>
              Банк пуст. Зайди первым — таймер запустится, и остальные успеют
              присоединиться. Если никто не придёт, добьём ботами.
            </p>
          )}

          <p className="muted center" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
            Шанс равен доле твоей ставки в банке. Комиссия {Math.round(RAKE * 100)}%.
            {shown?.fair.serverSeed && (
              <><br /><span className="mono" style={{ fontSize: 10 }}>сид: {shown.fair.serverSeed.slice(0, 32)}…</span></>
            )}
          </p>
        </div>
      </div>

      <div className="action-bar" style={{ flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
        <BetInput value={bet} onChange={setBet} max={maxBet} />
        <button
          className="btn"
          disabled={busy || spinning || bet > maxBet || !!mine}
          onClick={() => void join()}
        >
          {mine ? 'Ты уже в банке' : spinning ? 'Розыгрыш…' : `Войти в банк · ${fmt(bet)} MX`}
        </button>
      </div>
    </div>
  )
}
