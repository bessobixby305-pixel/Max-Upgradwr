import { useState } from 'react'
import { ItemCard, Sheet } from '../../components/ui'
import Icon from '../../components/Icon'
import { fmt, levelFromXp, xpForLevel } from '../../core/economy'
import { ITEM_BY_ID, sortedByPrice } from '../../core/items'
import { useGame } from '../../store/game'
import { sfx } from '../../lib/fx'

/** Инструменты, работающие без сервера: этим устройством и оффлайн-кодами. */
export default function DeviceAdmin({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const [money, setMoney] = useState('100000')
  const [lvl, setLvl] = useState(String(levelFromXp(g.xp).lvl))
  const [codeAmount, setCodeAmount] = useState('10000')
  const [codeItems, setCodeItems] = useState<string[]>([])
  const [pickOpen, setPickOpen] = useState(false)
  const [pickFor, setPickFor] = useState<'grant' | 'code'>('code')
  const [lastCode, setLastCode] = useState<string | null>(null)

  const num = (s: string) => Math.max(0, Math.floor(Number(s.replace(/\D/g, '')) || 0))

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text)
    g.toast('Скопировано')
  }

  return (
    <>
      <div>
        <div>

          <div className="sec-title" style={{ padding: '0 2px 10px' }}>Баланс</div>
          <div className="card">
            <input
              className="field mono"
              inputMode="numeric"
              value={money}
              onChange={(e) => setMoney(e.target.value.replace(/\D/g, ''))}
            />
            <div className="chips" style={{ margin: '10px 0' }}>
              {['1000', '10000', '100000', '1000000', '100000000'].map((v) => (
                <button key={v} className="chip mono" onClick={() => setMoney(v)}>{fmt(+v)}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                onClick={() => { g.addBalance(num(money)); sfx.coin(); g.toast(`+${fmt(num(money))} MX`) }}
              >Выдать</button>
              <button
                className="btn ghost"
                onClick={() => { useGame.setState({ balance: num(money) }); g.toast(`Баланс ${fmt(num(money))}`) }}
              >Задать</button>
            </div>
          </div>

          <div className="sec-title" style={{ padding: '18px 2px 10px' }}>Предметы</div>
          <div className="card">
            <button
              className="btn ghost"
              onClick={() => { setPickFor('grant'); setPickOpen(true) }}
            >Выдать предмет</button>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
              В инвентаре {g.inventory.length} шт. на {fmt(
                g.inventory.reduce((s, i) => s + (ITEM_BY_ID[i.id]?.price ?? 0), 0),
              )} MX
            </div>
          </div>

          <div className="sec-title" style={{ padding: '18px 2px 10px' }}>Уровень</div>
          <div className="card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="field mono"
                inputMode="numeric"
                value={lvl}
                onChange={(e) => setLvl(e.target.value.replace(/\D/g, ''))}
              />
              <button
                className="btn sm"
                style={{ flex: 'none' }}
                onClick={() => {
                  const n = Math.max(1, Math.min(120, num(lvl) || 1))
                  g.setXp(xpForLevel(n))
                  g.toast(`Уровень ${n}`)
                }}
              >Задать</button>
            </div>
            <div className="muted mono" style={{ fontSize: 12.5, marginTop: 8 }}>
              сейчас {levelFromXp(g.xp).lvl} · {fmt(g.xp)} XP
            </div>
          </div>

          <div className="sec-title" style={{ padding: '18px 2px 10px' }}>Выпуск промокода</div>
          <div className="card">
            <input
              className="field mono"
              inputMode="numeric"
              placeholder="сколько MX"
              value={codeAmount}
              onChange={(e) => setCodeAmount(e.target.value.replace(/\D/g, ''))}
            />
            <button
              className="btn ghost"
              style={{ marginTop: 10 }}
              onClick={() => { setPickFor('code'); setPickOpen(true) }}
            >
              {codeItems.length ? `Предметов: ${codeItems.length}` : 'Добавить предметы'}
            </button>
            {codeItems.length > 0 && (
              <div className="chips" style={{ marginTop: 10 }}>
                {codeItems.map((id, i) => (
                  <button
                    key={id + i}
                    className="chip"
                    onClick={() => setCodeItems(codeItems.filter((_, k) => k !== i))}
                  >{ITEM_BY_ID[id].emo} {ITEM_BY_ID[id].name} ✕</button>
                ))}
              </div>
            )}
            <button
              className="btn"
              style={{ marginTop: 12 }}
              disabled={num(codeAmount) === 0 && codeItems.length === 0}
              onClick={() => {
                const code = g.issueCode({ amount: num(codeAmount), items: codeItems })
                setLastCode(code)
                sfx.win()
              }}
            >Создать код</button>

            {lastCode && (
              <div className="pop" style={{ marginTop: 14, textAlign: 'center' }}>
                <div className="muted" style={{ fontSize: 12 }}>Готово, код работает на любом устройстве</div>
                <div
                  className="mono"
                  style={{ fontSize: 17, fontWeight: 700, margin: '6px 0 10px', wordBreak: 'break-all' }}
                >{lastCode}</div>
                <button className="btn ghost" onClick={() => copy(lastCode)}>Скопировать</button>
              </div>
            )}
          </div>

          {g.adminCodes.length > 0 && (
            <>
              <div className="sec-title" style={{ padding: '18px 2px 10px' }}>
                Выпущенные коды · {g.adminCodes.length}
              </div>
              <div className="list">
                {g.adminCodes.map((c) => (
                  <div className="row" key={c.code}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div className="t mono" style={{ fontSize: 13, wordBreak: 'break-all' }}>{c.code}</div>
                      <div className="s">
                        {c.amount > 0 && `${fmt(c.amount)} MX`}
                        {c.amount > 0 && c.items.length > 0 && ' · '}
                        {c.items.map((id) => ITEM_BY_ID[id]?.emo).join(' ')}
                      </div>
                    </span>
                    <button className="icon-btn" onClick={() => copy(c.code)} aria-label="Копировать">
                      <Icon name="save" size={18} />
                    </button>
                    <button className="icon-btn" onClick={() => g.forgetCode(c.code)} aria-label="Удалить">
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 12, padding: '10px 4px 0', lineHeight: 1.5 }}>
                Код нельзя отозвать: он проверяется на устройстве без обращения к серверу.
                Удаление из списка убирает его только отсюда.
              </p>
            </>
          )}

          <div className="sec-title" style={{ padding: '18px 2px 10px' }}>Опасное</div>
          <div className="list">
            <button
              className="row"
              onClick={() => {
                useGame.setState({ promos: [] })
                g.toast('Использованные коды сброшены')
              }}
            >
              <Icon name="reset" size={20} className="row-ico" />
              <span className="t">Разрешить повторный ввод кодов</span>
            </button>
            <button
              className="row"
              onClick={() => {
                if (confirm('Выключить админ-панель? Вернуть её можно кодом.')) {
                  g.setAdmin(false)
                  onBack()
                }
              }}
            >
              <Icon name="close" size={20} className="row-ico" style={{ color: 'var(--red)' }} />
              <span className="t" style={{ color: 'var(--red)' }}>Выключить админ-панель</span>
            </button>
          </div>
        </div>
      </div>

      <Sheet
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        title={pickFor === 'grant' ? 'Выдать предмет' : 'Добавить в код'}
      >
        <div className="grid">
          {sortedByPrice.map((it) => (
            <ItemCard
              key={it.id}
              id={it.id}
              onClick={() => {
                if (pickFor === 'grant') {
                  g.addItem(it.id)
                  g.toast(`${it.emo} ${it.name}`)
                } else {
                  setCodeItems((s) => [...s, it.id].slice(0, 8))
                }
                sfx.click()
                setPickOpen(false)
              }}
            />
          ))}
        </div>
      </Sheet>
    </>
  )
}
