import React, { useEffect, useRef, useState } from 'react'
import { ITEM_BY_ID, RARITY_COLOR, rarityOf } from '../core/items'
import { fmt } from '../core/economy'
import { useGame } from '../store/game'
import Icon from './Icon'

export function Header({
  title, sub, onBack, right,
}: {
  title: string; sub?: string; onBack?: () => void; right?: React.ReactNode
}) {
  // высота шапки нужна липким панелям под ней: она разная от экрана к экрану
  // и зависит от выреза, поэтому её нельзя зашивать числом
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const apply = () => document.documentElement.style.setProperty('--hdr-h', `${el.offsetHeight}px`)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="hdr" ref={ref}>
      {onBack && (
        <button className="back-btn" onClick={onBack} aria-label="Назад">
          <Icon name="back" size={22} />
        </button>
      )}
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: onBack ? 18 : 23 }}>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <div className="hdr-right">{right}</div>
    </div>
  )
}

export function BalancePill() {
  const balance = useGame((s) => s.balance)
  const shown = useAnimatedNumber(balance, 520)
  const [bump, setBump] = useState(false)
  const prev = useRef(balance)

  useEffect(() => {
    if (prev.current !== balance) {
      prev.current = balance
      setBump(true)
      const t = setTimeout(() => setBump(false), 460)
      return () => clearTimeout(t)
    }
  }, [balance])

  return (
    <span className={'balance-pill mono' + (bump ? ' bump' : '')}>
      <Icon name="coin" size={15} stroke={1.9} />
      {fmt(shown)}
    </span>
  )
}

export function Sheet({
  open, onClose, children, title,
}: {
  open: boolean; onClose: () => void; children: React.ReactNode; title?: string
}) {
  if (!open) return null
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        {title && (
          <div style={{ fontSize: 19, fontWeight: 800, margin: '0 4px 14px' }}>{title}</div>
        )}
        {children}
      </div>
    </div>
  )
}

export function ItemCard({
  id, onClick, sub, selected,
}: {
  id: string; onClick?: () => void; sub?: React.ReactNode; selected?: boolean
}) {
  const def = ITEM_BY_ID[id]
  if (!def) return null
  const rar = rarityOf(def.price)
  return (
    <div
      className={'item ' + rar}
      style={{
        ['--rc' as any]: RARITY_COLOR[rar],
        outline: selected ? '2px solid var(--accent)' : undefined,
        outlineOffset: 2,
      }}
      onClick={onClick}
    >
      <div className="emo">{def.emo}</div>
      <div className="nm">{def.name}</div>
      <div className="px mono">{sub ?? fmt(def.price)}</div>
      <span className="rbar" />
    </div>
  )
}

const MAX_TOASTS = 3

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  const shown = toasts.slice(-MAX_TOASTS)
  const hidden = toasts.length - shown.length
  return (
    <div className="toasts">
      {hidden > 0 && <div className="toast">и ещё {hidden}…</div>}
      {shown.map((t) => <div className="toast" key={t.id}>{t.text}</div>)}
    </div>
  )
}

/** Поле ввода ставки с быстрыми кнопками. */
export function BetInput({
  value, onChange, max, min = 1,
}: {
  value: number; onChange: (n: number) => void; max: number; min?: number
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])
  const commit = (raw: string) => {
    const n = Math.floor(Number(raw.replace(/\D/g, '')) || 0)
    onChange(Math.max(min, Math.min(max, n)))
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="field mono"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
          onBlur={() => commit(text)}
          placeholder="Ставка"
        />
      </div>
      <div className="chips" style={{ marginTop: 8 }}>
        {[
          { l: '−50%', f: () => onChange(Math.max(min, Math.floor(value / 2))) },
          { l: '+50%', f: () => onChange(Math.min(max, Math.ceil(value * 1.5))) },
          { l: 'x2', f: () => onChange(Math.min(max, value * 2)) },
          { l: '100', f: () => onChange(Math.min(max, 100)) },
          { l: '1K', f: () => onChange(Math.min(max, 1000)) },
          { l: 'Всё', f: () => onChange(Math.max(min, max)) },
        ].map((b) => (
          <button className="chip" key={b.l} onClick={b.f}>{b.l}</button>
        ))}
      </div>
    </div>
  )
}

/** Плавно «догоняющее» число — для баланса и множителей. */
export function useAnimatedNumber(target: number, ms = 420) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  const start = useRef(0)
  useEffect(() => {
    from.current = v
    start.current = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start.current) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      setV(from.current + (target - from.current) * e)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])
  return v
}
