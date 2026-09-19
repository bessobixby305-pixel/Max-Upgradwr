import { useEffect, useState } from 'react'
import { BalancePill, Header } from '../components/ui'
import Icon from '../components/Icon'
import { useGame } from '../store/game'
import { useAccount } from '../store/account'
import { onlineMode, serverCall, serverGet } from '../lib/round'
import ServerAdmin, { AdminTab } from './admin/Server'
import DeviceAdmin from './admin/Device'

/** Админка. Вход только с аккаунтом и только по серверному коду:
 *  без этого панель не показывает ни одного инструмента. */
export default function Admin({ onBack, go }: { onBack: () => void; go: (r: { s: 'account' }) => void }) {
  const g = useGame()
  const acc = useAccount()
  const online = onlineMode()
  const [mode, setMode] = useState<'server' | 'device'>('server')
  const [tab, setTab] = useState<AdminTab>('stats')
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [configured, setConfigured] = useState(true)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!online) { setIsAdmin(false); return }
    serverGet<{ admin: boolean; configured: boolean }>('/admin/me')
      .then((r) => { setIsAdmin(r.admin); setConfigured(r.configured) })
      .catch(() => setIsAdmin(false))
  }, [online, acc.role])

  const claim = async () => {
    if (busy) return
    setBusy(true)
    try {
      await serverCall('/admin/claim', { code: code.trim() })
      // роль в токене ещё старая — перезабираем профиль
      await acc.loadMe()
      setIsAdmin(true)
      setCode('')
      g.toast('Права администратора выданы')
    } catch (e) {
      g.toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const header = (sub: string) => (
    <Header title="Админ-панель" sub={sub} onBack={onBack} right={<BalancePill />} />
  )

  // ——— без аккаунта панель не открывается вовсе
  if (!online) {
    return (
      <>
        {header('нужен вход')}
        <div className="screen">
          <div className="pad">
            <div className="card center">
              <Icon name="shield" size={34} style={{ color: 'var(--text-3)' }} />
              <div style={{ fontWeight: 800, fontSize: 17, margin: '10px 0 6px' }}>Нужен вход в аккаунт</div>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Админка управляет живой экономикой на сервере, поэтому работает
                только с аккаунтом. Войди или зарегистрируйся, потом вернись сюда
                и введи админ-код.
              </p>
              <button className="btn" style={{ marginTop: 14 }} onClick={() => go({ s: 'account' })}>
                Перейти к аккаунту
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ——— вход есть, но прав ещё нет: только форма кода
  if (isAdmin !== true) {
    return (
      <>
        {header('нужен админ-код')}
        <div className="screen">
          <div className="pad">
            {isAdmin === null ? (
              <div className="card center muted">Проверяем права…</div>
            ) : (
              <div className="card">
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>Нужны права администратора</div>
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
                  {configured
                    ? 'Введи админ-код. Он задан на сервере и в приложение не зашит, поэтому вытащить его из файла нельзя. Права выдаются твоему аккаунту навсегда.'
                    : 'На сервере не задан админ-код. Добавь секрет ADMIN_CODE в репозиторий и перезапусти деплой.'}
                </p>
                {configured && (
                  <>
                    <input
                      className="field"
                      type="password"
                      placeholder="Админ-код"
                      autoCapitalize="none"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void claim() }}
                    />
                    <button
                      className="btn"
                      style={{ marginTop: 10 }}
                      disabled={busy || code.trim().length < 3}
                      onClick={() => void claim()}
                    >Получить права</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  // ——— полноценная панель
  return (
    <>
      {header(mode === 'server' ? 'сервер и живая экономика' : 'только это устройство')}
      <div className="screen">
        <div className="pad">
          {/* обе строки вкладок в одном липком блоке: два вложенных
              липких элемента разъезжались и прятали верхний под шапкой */}
          <div className="tabs-sticky">
            <div className="chips">
              <button className={'chip' + (mode === 'server' ? ' on' : '')} onClick={() => setMode('server')}>
                Сервер
              </button>
              <button className={'chip' + (mode === 'device' ? ' on' : '')} onClick={() => setMode('device')}>
                Устройство
              </button>
            </div>
            {mode === 'server' && (
              <div className="chips">
                {([['stats', 'Сводка'], ['users', 'Игроки'], ['promos', 'Коды'], ['log', 'Журнал']] as const).map(
                  ([id, label]) => (
                    <button key={id} className={'chip' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
                      {label}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {mode === 'server' ? <ServerAdmin tab={tab} /> : <DeviceAdmin onBack={onBack} />}
        </div>
      </div>
    </>
  )
}
