import { useGame } from '../store/game'

let ctx: AudioContext | null = null
const ac = () => {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

type Tone = { f: number; t: number; d: number; type?: OscillatorType; v?: number }

function play(tones: Tone[]) {
  if (!useGame.getState().settings.sound) return
  try {
    const c = ac()
    const now = c.currentTime
    for (const tn of tones) {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = tn.type ?? 'sine'
      o.frequency.setValueAtTime(tn.f, now + tn.t)
      g.gain.setValueAtTime(0, now + tn.t)
      g.gain.linearRampToValueAtTime(tn.v ?? 0.08, now + tn.t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, now + tn.t + tn.d)
      o.connect(g).connect(c.destination)
      o.start(now + tn.t)
      o.stop(now + tn.t + tn.d + 0.02)
    }
  } catch { /* звук не критичен */ }
}

export const sfx = {
  tick: () => play([{ f: 1500, t: 0, d: 0.03, type: 'square', v: 0.025 }]),
  click: () => play([{ f: 620, t: 0, d: 0.05, type: 'triangle', v: 0.05 }]),
  win: () => play([
    { f: 523, t: 0, d: 0.16 }, { f: 659, t: 0.09, d: 0.16 },
    { f: 784, t: 0.18, d: 0.2 }, { f: 1046, t: 0.27, d: 0.34 },
  ]),
  bigWin: () => play([
    { f: 523, t: 0, d: 0.15 }, { f: 659, t: 0.1, d: 0.15 }, { f: 784, t: 0.2, d: 0.15 },
    { f: 1046, t: 0.3, d: 0.2 }, { f: 1318, t: 0.42, d: 0.22 }, { f: 1568, t: 0.54, d: 0.5 },
  ]),
  lose: () => play([
    { f: 330, t: 0, d: 0.18, type: 'sawtooth', v: 0.05 },
    { f: 220, t: 0.12, d: 0.3, type: 'sawtooth', v: 0.05 },
  ]),
  boom: () => play([{ f: 90, t: 0, d: 0.45, type: 'sawtooth', v: 0.12 }]),
  coin: () => play([{ f: 988, t: 0, d: 0.07 }, { f: 1319, t: 0.06, d: 0.14 }]),
  msg: () => play([{ f: 880, t: 0, d: 0.06, v: 0.04 }, { f: 1175, t: 0.05, d: 0.1, v: 0.04 }]),
}

export function haptic(pattern: number | number[] = 12) {
  if (!useGame.getState().settings.haptics) return
  try { navigator.vibrate?.(pattern) } catch { /* не поддерживается */ }
}

const CONFETTI_COLORS = ['#7C5CFF', '#3F8CFF', '#FFB020', '#FF4FA3', '#2FBF61']

export function confetti(host: HTMLElement | null, count = 70) {
  if (!host) return
  const box = document.createElement('div')
  box.className = 'confetti'
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i')
    p.style.left = Math.random() * 100 + '%'
    p.style.background = CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0]
    p.style.animationDuration = 1.4 + Math.random() * 1.4 + 's'
    p.style.animationDelay = Math.random() * 0.35 + 's'
    p.style.borderRadius = Math.random() > 0.6 ? '50%' : '2px'
    box.appendChild(p)
  }
  host.appendChild(box)
  setTimeout(() => box.remove(), 3400)
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
