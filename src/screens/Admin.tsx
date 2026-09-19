import { useEffect, useState } from 'react'
import { BalancePill, Header } from '../components/ui'
import { useGame } from '../store/game'
import { useAccount } from '../store/account'
import { onlineMode, serverCall, serverGet } from '../lib/round'
import ServerAdmin from './admin/Server'
import DeviceAdmin from './admin/Device'

/** Админка: серверная часть для живой экономики и оффлайновая для устройства. */
export default function Admin({ onBack }: { onBack: () => void }) {
  const g = useGame()
  const acc = useAccount()
  const online = onlineMode()
  const [mode, setMode] = useState<'server' | 'device'>(online ? 'server' : 'device')
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

  return (
    <>
      <Header
        title="Админ-панель"
        sub={mode === 'server' ? 'сервер и живая экономика' : 'только это устройство'}
        onBack={onBack}
        right={<BalancePill />}
      />
      <div className="screen">
        <div className="pad">
          {online && (
            <div className="tabs-sticky">
              <div className="chips">
                <button className={'chip' + (mode === 'server' ? ' on' : '')} onClick={() => setMode('server')}>
                  Сервер
                </button>
                <button className={'chip' + (mode === 'device' ? ' on' : '')} onClick={() => setMode('device')}>
                  Устройство
                </button>
              </div>
            </div>
          )}

          {mode === 'server' && (
            isAdmin === null ? (
              <div className="card center muted">Проверяем права…</div>
            ) : isAdmin ? (
              <ServerAdmin />
            ) : (
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Нужны права администратора</div>
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
                  {configured
                    ? 'Введи админ-код — он задан на сервере и в приложение не зашит. Права выдаются твоему аккаунту навсегда.'
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
            )
          )}

          {mode === 'device' && <DeviceAdmin onBack={onBack} />}
        </div>
      </div>
    </>
  )
}
