import { useCallback, useEffect, useRef, useState } from 'react'
import { BalancePill, Header } from '../../components/ui'
import { CASES, CaseDef, pickDrop } from '../../core/cases'
import { ITEM_BY_ID, RARITY_COLOR, rarityOf } from '../../core/items'
import { fmt } from '../../core/economy'
import { useGame } from '../../store/game'
import { localRng, onlineMode, serverCall, serverGet } from '../../lib/round'
import { useAccount } from '../../store/account'
import { confetti, haptic, sfx, wait } from '../../lib/fx'
import Icon from '../../components/Icon'

const BOT_NAMES = ['Артём_max', 'Ника228', 'Тимур_pro', 'Соня🍀', 'Денис_off', 'Влад ЪУЪ']
const BOT_EMOS = ['🐱', '🐼', '🦊', '🐸', '👾', '🎧']

interface Seat {
  seat: number
  name: string
  emo: string
  bot: boolean
  me: boolean
  drops: string[]
  total: number
}
interface BattleState {
  id: string
  caseId: string
  rounds: number
  seats: number
  bet: number
  status: 'open' | 'done'
  winnerSeat: number | null
  mySeat: number | null
  players: Seat[]
  fair: { serverSeedHash: string; serverSeed: string | null }
}

const LIST_POLL = 2500
const ROOM_POLL = 1500

export default function Battle({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const online = onlineMode()
  const [caseDef, setCaseDef] = useState<CaseDef>(CASES[1])
  const [rounds, setRounds] = useState(3)
  const [seats, setSeats] = useState(2)
  const [tab, setTab] = useState<'open' | 'new'>(online ? 'open' : 'new')
  const [list, setList] = useState<BattleState[]>([])
  const [room, setRoom] = useState<BattleState | null>(null)
  /** сколько раундов уже показано — битва приходит целиком, а вскрываем по одному */
  const [shown, setShown] = useState(0)
  const [busy, setBusy] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)
  const revealing = useRef(false)

  const cost = caseDef.price * rounds

  // ——— список открытых битв
  const pullList = useCallback(async () => {
    if (!online) return
    try {
      const r = await serverGet<{ battles: BattleState[] }>('/battle/list')
      setList(r.battles)
    } catch { /* моргнула связь — покажем на следующем опросе */ }
  }, [online])

  useEffect(() => {
    if (!online || room || tab !== 'open') return
    void pullList()
    const t = setInterval(() => void pullList(), LIST_POLL)
    return () => clearInterval(t)
  }, [online, room, tab, pullList])

  // ——— открытая комната: ждём, пока соберутся места
  useEffect(() => {
    if (!online || !room || room.status === 'done') return
    const t = setInterval(async () => {
      try {
        const fresh = await serverGet<BattleState>(`/battle/${room.id}`)
        setRoom(fresh)
      } catch { /* повторим */ }
    }, ROOM_POLL)
    return () => clearInterval(t)
  }, [online, room])

  // ——— вскрываем раунды по одному
  useEffect(() => {
    if (!room || room.status !== 'done' || revealing.current) return
    revealing.current = true
    let alive = true
    ;(async () => {
      for (let r = 1; r <= room.rounds; r++) {
        await wait(g.settings.fastMode ? 220 : 800)
        if (!alive) return
        setShown(r)
        sfx.tick()
      }
      await wait(400)
      if (!alive) return
      const won = room.mySeat !== null && room.winnerSeat === room.mySeat
      if (won) {
        confetti(hostRef.current, 140)
        sfx.bigWin()
        haptic([0, 50, 60, 50])
      } else {
        sfx.lose()
        haptic(140)
      }
      // серверный баланс и инвентарь меняются битвой — забираем свежие
      if (online) void useAccount.getState().loadMe()
      const pot = room.players.reduce((s, p) => s + p.total, 0)
      g.pushResult({
        kind: 'battle',
        title: `Битва · ${CASES.find((c) => c.id === room.caseId)?.name ?? ''} ×${room.rounds}`,
        bet: room.bet,
        payout: won ? pot : 0,
        extra: won ? 'забрал все предметы' : `победил ${room.players[room.winnerSeat ?? 0]?.name}`,
      })
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.status])

  const enterRoom = (b: BattleState) => {
    revealing.current = false
    setShown(b.status === 'done' ? 0 : b.rounds)
    setRoom(b)
  }

  const act = async (fn: () => Promise<BattleState>) => {
    if (busy) return
    setBusy(true)
    try {
      enterRoom(await fn())
      sfx.click()
      // вход в битву списывает ставку на сервере — забираем новый баланс
      if (online) void useAccount.getState().loadMe()
    } catch (e) {
      g.toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // ——— офлайн: та же битва, но целиком на устройстве
  async function playOffline() {
    if (busy) return
    if (!g.bet(cost)) { g.toast('Недостаточно MX'); return }
    setBusy(true)
    sfx.click()

    const rng = localRng()
    const roster: Seat[] = [
      { seat: 0, name: 'Ты', emo: '🦄', bot: false, me: true, drops: [], total: 0 },
      ...[...Array(seats - 1)].map((_, i) => ({
        seat: i + 1, name: BOT_NAMES[i], emo: BOT_EMOS[i % BOT_EMOS.length],
        bot: true, me: false, drops: [] as string[], total: 0,
      })),
    ]
    for (const p of roster) {
      for (let r = 0; r < rounds; r++) {
        const item = pickDrop(caseDef, rng.roll(p.seat * 100 + r))
        p.drops.push(item.id)
        p.total += item.price
      }
    }
    let best = roster[0]
    for (const p of roster) if (p.total > best.total) best = p

    const pot = roster.reduce((s, p) => s + p.total, 0)
    if (best.me) {
      for (const p of roster) for (const id of p.drops) g.addItem(id)
      g.recordWin(pot)
      g.bumpStats({ wins: g.stats.wins + 1, battlesWon: g.stats.battlesWon + 1 })
    } else {
      g.bumpStats({ losses: g.stats.losses + 1 })
    }
    g.bumpStats({ spins: g.stats.spins + 1, casesOpened: g.stats.casesOpened + rounds })
    g.checkAchievements()

    revealing.current = false
    setShown(0)
    setRoom({
      id: 'offline', caseId: caseDef.id, rounds, seats, bet: cost,
      status: 'done', winnerSeat: best.seat, mySeat: 0, players: roster,
      fair: { serverSeedHash: '', serverSeed: null },
    })
    setBusy(false)
  }

  // ═══════════════════════════════════════════ комната
  if (room) {
    const box = CASES.find((c) => c.id === room.caseId) ?? CASES[0]
    const waiting = room.status === 'open'
    const pot = room.players.reduce((s, p) => s + p.total, 0)
    const iAmHost = room.mySeat === 0

    return (
      <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Header
          title={`Битва · ${box.name}`}
          sub={waiting ? `ждём игроков · ${room.players.length} из ${room.seats}` : `банк ${fmt(pot)} MX предметами`}
          onBack={() => { setRoom(null); void pullList() }}
          right={<BalancePill />}
        />
        <div className="screen">
          <div className="pad">
            {waiting && (
              <div className="card center" style={{ marginBottom: 14 }}>
                <div className="bt-wait">
                  <span /><span /><span />
                </div>
                <div style={{ fontWeight: 700, marginTop: 8 }}>Ждём соперников</div>
                <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0', lineHeight: 1.6 }}>
                  Битва начнётся сама, как только займут все места.
                  Ссылку давать не нужно — бой уже виден в списке открытых.
                </p>
                {iAmHost && (
                  <button
                    className="btn ghost"
                    style={{ marginTop: 12 }}
                    disabled={busy}
                    onClick={() => void act(() => serverCall<BattleState>(`/battle/${room.id}/bots`))}
                  >Добить ботами и начать</button>
                )}
              </div>
            )}

            <div className="bt-grid" style={{ ['--cols' as any]: Math.min(2, room.seats) }}>
              {[...Array(room.seats)].map((_, i) => {
                const p = room.players.find((x) => x.seat === i)
                const win = room.status === 'done' && room.winnerSeat === i
                return (
                  <div key={i} className={'bt-seat' + (win ? ' win' : '') + (p?.me ? ' mine' : '')}>
                    {p ? (
                      <>
                        <div className="bt-head">
                          <span className="avatar sm">{p.emo}</span>
                          <b className="bt-name">{p.me ? 'Ты' : p.name}</b>
                          {win && <span style={{ fontSize: 15 }}>🏆</span>}
                        </div>
                        <div className="bt-drops">
                          {[...Array(room.rounds)].map((_, k) => {
                            const id = k < shown ? p.drops[k] : undefined
                            const def = id ? ITEM_BY_ID[id] : undefined
                            return (
                              <span
                                key={k}
                                className={'bt-drop' + (def ? ' pop' : '')}
                                style={def ? { borderBottomColor: RARITY_COLOR[rarityOf(def.price)] } : undefined}
                                title={def?.name}
                              >{def?.emo ?? ''}</span>
                            )
                          })}
                        </div>
                        <div className="bt-total mono">
                          {fmt(p.drops.slice(0, shown).reduce((s, id) => s + (ITEM_BY_ID[id]?.price ?? 0), 0))}
                        </div>
                      </>
                    ) : (
                      <div className="bt-empty">
                        <Icon name="user" size={22} />
                        <span>свободно</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {room.status === 'done' && shown >= room.rounds && (
              <div className="card center" style={{ marginTop: 14 }}>
                <div style={{ fontSize: 30 }}>{room.winnerSeat === room.mySeat ? '🏆' : '💔'}</div>
                <b style={{ fontSize: 17 }}>
                  {room.winnerSeat === room.mySeat
                    ? `Ты забрал банк · ${fmt(pot)} MX предметами`
                    : `Победил ${room.players.find((p) => p.seat === room.winnerSeat)?.name}`}
                </b>
                {room.fair.serverSeed && (
                  <div className="muted mono" style={{ fontSize: 10, marginTop: 8, wordBreak: 'break-all' }}>
                    сид битвы: {room.fair.serverSeed}
                  </div>
                )}
                <button
                  className="btn"
                  style={{ marginTop: 12 }}
                  onClick={() => { setRoom(null); setTab(online ? 'open' : 'new'); void pullList() }}
                >Ещё раз</button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════ список и создание
  return (
    <div ref={hostRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header
        title="Битвы кейсов"
        sub={online ? 'играй против живых' : 'офлайн: только боты'}
        onBack={onBack}
        right={<BalancePill />}
      />
      <div className="screen">
        <div className="pad">
          {online && (
            <div className="chips" style={{ marginBottom: 14 }}>
              <button className={'chip' + (tab === 'open' ? ' on' : '')} onClick={() => setTab('open')}>
                Открытые {list.length > 0 && <b>· {list.length}</b>}
              </button>
              <button className={'chip' + (tab === 'new' ? ' on' : '')} onClick={() => setTab('new')}>
                Создать
              </button>
            </div>
          )}

          {online && tab === 'open' && (
            list.length === 0 ? (
              <div className="card center">
                <div style={{ fontSize: 30 }}>⚔️</div>
                <b>Открытых битв нет</b>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.6 }}>
                  Создай свою — её увидят все, кто зайдёт сюда.
                  Ждать необязательно: свободные места добиваются ботами.
                </p>
                <button className="btn" style={{ marginTop: 12 }} onClick={() => setTab('new')}>Создать битву</button>
              </div>
            ) : (
              <div className="list">
                {list.map((b) => {
                  const box = CASES.find((c) => c.id === b.caseId) ?? CASES[0]
                  const mine = b.mySeat !== null
                  return (
                    <button
                      key={b.id}
                      className="row"
                      disabled={busy}
                      onClick={() => (mine
                        ? enterRoom(b)
                        : void act(() => serverCall<BattleState>(`/battle/${b.id}/join`)))}
                    >
                      <span className="bt-case" style={{ ['--tint' as any]: box.tint }}>{box.emo}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <div className="t">{box.name} ×{b.rounds}</div>
                        <div className="s">
                          {b.players.map((p) => (p.me ? 'ты' : p.name)).join(', ')}
                        </div>
                      </span>
                      <span className="r">
                        <div className="mono" style={{ fontWeight: 800, color: 'var(--text)' }}>{fmt(b.bet)}</div>
                        <div style={{ fontSize: 11.5 }}>{b.players.length}/{b.seats} · {mine ? 'войти' : 'играть'}</div>
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          )}

          {(!online || tab === 'new') && (
            <>
              <div className="sec-title">Кейс</div>
              <div className="chips">
                {CASES.map((c) => (
                  <button
                    key={c.id}
                    className={'chip' + (caseDef.id === c.id ? ' on' : '')}
                    onClick={() => setCaseDef(c)}
                  >{c.emo} {c.name}</button>
                ))}
              </div>

              <div className="sec-title">Раундов</div>
              <div className="chips">
                {[1, 2, 3, 5, 10].map((r) => (
                  <button key={r} className={'chip' + (rounds === r ? ' on' : '')} onClick={() => setRounds(r)}>×{r}</button>
                ))}
              </div>

              <div className="sec-title">Игроков</div>
              <div className="chips">
                {[2, 3, 4].map((s) => (
                  <button key={s} className={'chip' + (seats === s ? ' on' : '')} onClick={() => setSeats(s)}>{s}</button>
                ))}
              </div>

              <button
                className="btn"
                style={{ marginTop: 18 }}
                disabled={busy || g.balance < cost}
                onClick={() => (online
                  ? void act(() => serverCall<BattleState>('/battle/create', {
                      caseId: caseDef.id, rounds, seats,
                    }))
                  : void playOffline())}
              >
                {busy ? 'Минутку…' : `${online ? 'Создать битву' : 'В бой'} · ${fmt(cost)} MX`}
              </button>

              <p className="muted center" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.6 }}>
                Каждый платит вход, победитель забирает все выпавшие предметы.
                {online && ' Свободные места можно добить ботами — на шансы это не влияет.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
