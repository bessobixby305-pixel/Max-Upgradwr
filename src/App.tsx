import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { useGame } from './store/game'
import { Toasts } from './components/ui'
import Icon, { IconName } from './components/Icon'
import { startDropsFeed } from './lib/drops'
import Chats from './screens/Chats'
import ChatBot from './screens/ChatBot'
import DropsChannel from './screens/DropsChannel'
import Games from './screens/Games'
import Inventory from './screens/Inventory'
import Profile from './screens/Profile'
import Fairness from './screens/Fairness'
import Achievements from './screens/Achievements'
import Upgrade from './screens/games/Upgrade'
import Cases from './screens/games/Cases'
import Mines from './screens/games/Mines'
import Crash from './screens/games/Crash'
import Contract from './screens/games/Contract'
import Battle from './screens/games/Battle'
import DailyWheel from './screens/games/DailyWheel'
import Double from './screens/games/Double'
import Dice from './screens/games/Dice'
import Tower from './screens/games/Tower'
import Slots from './screens/games/Slots'
import Jackpot from './screens/games/Jackpot'

export type Tab = 'chats' | 'games' | 'inv' | 'profile'
export type Route =
  | { s: 'chatBot' } | { s: 'drops' } | { s: 'fair' } | { s: 'ach' }
  | { s: 'upgrade' } | { s: 'cases' } | { s: 'mines' } | { s: 'crash' }
  | { s: 'contract' } | { s: 'battle' } | { s: 'wheel' }
  | { s: 'double' } | { s: 'dice' } | { s: 'tower' } | { s: 'slots' } | { s: 'jackpot' }

const TABS: { id: Tab; ico: IconName; label: string }[] = [
  { id: 'chats', ico: 'chat', label: 'Чаты' },
  { id: 'games', ico: 'games', label: 'Игры' },
  { id: 'inv', ico: 'bag', label: 'Инвентарь' },
  { id: 'profile', ico: 'user', label: 'Профиль' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('games')
  const [stack, setStack] = useState<Route[]>([])
  const theme = useGame((s) => s.settings.theme)
  const unread = useGame((s) => s.messages.filter((m) => m.chat === 'bot').length)

  const push = useCallback((r: Route) => setStack((s) => [...s, r]), [])
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), [])

  useEffect(() => {
    const apply = () => {
      const dark =
        theme === 'dark' ||
        (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => startDropsFeed(), [])

  // аппаратная кнопка «назад» на Android: закрываем экран, а не приложение
  const stackLen = useRef(0)
  stackLen.current = stack.length
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handle = CapApp.addListener('backButton', () => {
      if (stackLen.current > 0) pop()
      else void CapApp.exitApp()
    })
    return () => { void handle.then((h) => h.remove()) }
  }, [pop])

  useEffect(() => { useGame.getState().checkAchievements() }, [])

  const top = stack[stack.length - 1]

  const renderStack = () => {
    if (!top) return null
    switch (top.s) {
      case 'chatBot': return <ChatBot onBack={pop} go={push} />
      case 'drops': return <DropsChannel onBack={pop} />
      case 'fair': return <Fairness onBack={pop} />
      case 'ach': return <Achievements onBack={pop} />
      case 'upgrade': return <Upgrade onBack={pop} />
      case 'cases': return <Cases onBack={pop} />
      case 'mines': return <Mines onBack={pop} />
      case 'crash': return <Crash onBack={pop} />
      case 'contract': return <Contract onBack={pop} />
      case 'battle': return <Battle onBack={pop} />
      case 'wheel': return <DailyWheel onBack={pop} />
      case 'double': return <Double onBack={pop} />
      case 'dice': return <Dice onBack={pop} />
      case 'tower': return <Tower onBack={pop} />
      case 'slots': return <Slots onBack={pop} />
      case 'jackpot': return <Jackpot onBack={pop} />
    }
  }

  return (
    <div className="app">
      {top ? renderStack() : (
        <>
          {tab === 'chats' && <Chats go={push} />}
          {tab === 'games' && <Games go={push} />}
          {tab === 'inv' && <Inventory />}
          {tab === 'profile' && <Profile go={push} />}
        </>
      )}

      {!top && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={'tab' + (tab === t.id ? ' on' : '')}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.ico} size={23} stroke={tab === t.id ? 2 : 1.6} />
              <span>{t.label}</span>
              {t.id === 'chats' && unread > 0 && (
                <span className="badge">{unread > 99 ? '99+' : unread}</span>
              )}
            </button>
          ))}
        </nav>
      )}

      <Toasts />
    </div>
  )
}
