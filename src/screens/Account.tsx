import { useEffect, useState } from 'react'
import { Header, Sheet } from '../components/ui'
import Icon from '../components/Icon'
import { apiBase, apiConfigured, setApiBase } from '../lib/api'
import { useAccount } from '../store/account'
import { useGame } from '../store/game'
import { fmt } from '../core/economy'
import { sfx } from '../lib/fx'

const LOGIN_RE = /^[a-zA-Z0-9_]{3,24}$/

export default function Account({ onBack }: { onBack?: () => void }) {
  const a = useAccount()
  const toast = useGame((s) => s.toast)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [login, setLogin] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [srvOpen, setSrvOpen] = useState(false)
  const [srv, setSrv] = useState(apiBase())

  useEffect(() => {
    void a.ping()
    if (a.access) void a.loadMe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    setErr(null)
    if (!LOGIN_RE.test(login)) {
      setErr('Логин: 3–24 символа, латиница, цифры и подчёркивание')
      return
    }
    if (pass.length < 6) {
      setErr('Пароль — минимум 6 символов')
      return
    }
    const msg = mode === 'up' ? await a.signUp(login, pass) : await a.signIn(login, pass)
    if (msg) { setErr(msg); return }
    setPass('')
    sfx.coin()
    toast(mode === 'up' ? 'Аккаунт создан' : 'С возвращением!')
  }

  const serverRow = (
    <div className="list" style={{ marginTop: 14 }}>
      <button className="row" onClick={() => { setSrv(apiBase()); setSrvOpen(true) }}>
        <Icon name="cloud" size={20} className="row-ico" />
        <span className="t">Сервер</span>
        <span className="r mono" style={{ fontSize: 11.5, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {apiConfigured() ? apiBase().replace(/^https?:\/\//, '') : 'не задан'}
        </span>
      </button>
    </div>
  )

  const statusDot = (
    <span
      className="dot"
      style={{
        background: a.online == null ? 'var(--text-3)' : a.online ? 'var(--green)' : 'var(--red)',
      }}
    />
  )

  return (
    <>
      <Header title="Аккаунт" onBack={onBack} />
      <div className="screen">
        <div className="pad">
          {!apiConfigured() && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Сервер не настроен</div>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Эта сборка собрана без адреса сервера. Впиши его вручную ниже — и аккаунты заработают.
              </p>
            </div>
          )}

          {a.access && a.me ? (
            <>
              <div className="card center" style={{ marginBottom: 14 }}>
                <div className="avatar lg" style={{ margin: '0 auto 10px' }}>
                  <Icon name="user" size={38} stroke={1.4} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{a.me.login}</div>
                <div className="muted" style={{ fontSize: 13, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                  {statusDot}
                  {a.me.role === 'ADMIN' ? 'Администратор' : 'Игрок'} · в облаке
                </div>
              </div>

              <div className="stat-grid">
                <div className="stat"><div className="v mono">{fmt(a.me.balance)}</div><div className="l">Баланс на сервере</div></div>
                <div className="stat"><div className="v mono">{fmt(a.me.xp)}</div><div className="l">XP на сервере</div></div>
                <div className="stat"><div className="v mono">{fmt(a.me.inventory.length)}</div><div className="l">Предметов в облаке</div></div>
                <div className="stat"><div className="v mono">{fmt(a.me.stats.spins)}</div><div className="l">Раундов сыграно</div></div>
              </div>

              <div className="sec-title">Облако</div>
              <div className="list">
                <button
                  className="row"
                  disabled={a.busy}
                  onClick={async () => {
                    const msg = await a.loadMe()
                    toast(msg ?? 'Данные обновлены')
                  }}
                >
                  <Icon name="reset" size={20} className="row-ico" />
                  <span className="t">Обновить данные</span>
                </button>

                {!a.me.imported && (
                  <button
                    className="row"
                    disabled={a.busy}
                    onClick={async () => {
                      if (!confirm('Загрузить локальный прогресс в облако? Сделать это можно один раз.')) return
                      const msg = await a.uploadLocalSave()
                      toast(msg ?? 'Прогресс перенесён в облако')
                      if (!msg) sfx.coin()
                    }}
                  >
                    <Icon name="save" size={20} className="row-ico" style={{ color: 'var(--accent)' }} />
                    <span className="t" style={{ color: 'var(--accent)' }}>Перенести прогресс в облако</span>
                  </button>
                )}

                <button
                  className="row"
                  onClick={async () => {
                    if (!confirm('Выйти из аккаунта? Локальный прогресс останется на устройстве.')) return
                    await a.signOut()
                    toast('Вы вышли')
                  }}
                >
                  <Icon name="logout" size={20} className="row-ico" style={{ color: 'var(--red)' }} />
                  <span className="t" style={{ color: 'var(--red)' }}>Выйти</span>
                </button>
              </div>

              <div className="sec-title">Честность</div>
              <div className="card">
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
                  Хеш серверного сида
                  <div className="mono" style={{ fontSize: 10.5, wordBreak: 'break-all', color: 'var(--text)' }}>
                    {a.me.fair.serverSeedHash}
                  </div>
                  Клиентский сид: <span className="mono">{a.me.fair.clientSeed}</span> · раундов: {a.me.fair.nonce}
                </div>
              </div>

              {serverRow}
            </>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="chips" style={{ marginBottom: 14 }}>
                  <button className={'chip' + (mode === 'in' ? ' on' : '')} onClick={() => { setMode('in'); setErr(null) }}>
                    Вход
                  </button>
                  <button className={'chip' + (mode === 'up' ? ' on' : '')} onClick={() => { setMode('up'); setErr(null) }}>
                    Регистрация
                  </button>
                </div>

                <input
                  className="field"
                  placeholder="Логин"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={login}
                  onChange={(e) => setLogin(e.target.value.trim())}
                />
                <input
                  className="field"
                  style={{ marginTop: 10 }}
                  type="password"
                  placeholder="Пароль"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
                />

                {err && (
                  <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>{err}</div>
                )}

                <button className="btn" style={{ marginTop: 14 }} disabled={a.busy} onClick={() => void submit()}>
                  {a.busy ? 'Минутку…' : mode === 'up' ? 'Создать аккаунт' : 'Войти'}
                </button>

                <p className="muted" style={{ fontSize: 12.5, marginTop: 12, lineHeight: 1.6 }}>
                  Аккаунт нужен, чтобы прогресс жил в облаке и был одинаковым на телефоне и компьютере.
                  Без него игра работает как раньше — всё хранится только на этом устройстве.
                </p>
              </div>

              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  {statusDot}
                  <span className="muted">
                    {a.online == null ? 'Проверяем сервер…' : a.online ? 'Сервер на связи' : 'Сервер недоступен'}
                  </span>
                </div>
              </div>

              {serverRow}
            </>
          )}
        </div>
      </div>

      <Sheet open={srvOpen} onClose={() => setSrvOpen(false)} title="Адрес сервера">
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Полный адрес вместе с <span className="mono">https://</span>. Пустое поле вернёт адрес, зашитый при сборке.
        </p>
        <input
          className="field mono"
          style={{ marginTop: 10, fontSize: 12.5 }}
          placeholder="https://example.duckdns.org"
          autoCapitalize="none"
          autoCorrect="off"
          value={srv}
          onChange={(e) => setSrv(e.target.value)}
        />
        <button
          className="btn"
          style={{ marginTop: 12 }}
          onClick={async () => {
            setApiBase(srv)
            setSrvOpen(false)
            const ok = await a.ping()
            toast(ok ? 'Сервер отвечает' : 'Сервер не отвечает')
          }}
        >Сохранить и проверить</button>
      </Sheet>
    </>
  )
}
