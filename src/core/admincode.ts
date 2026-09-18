import { hmacSha256Hex } from './sha256'
import { ITEMS, ITEM_BY_ID } from './items'

/** Код входа в админ-панель. Вводится в обычное поле промокода. */
export const ADMIN_UNLOCK = 'MAXADMIN2026'

/** Общий секрет сборки. Лежит в клиенте, поэтому защищает от случайного
 *  подбора, но не от того, кто разберёт APK. Для игры на виртуальную
 *  валюту этого достаточно. */
const SECRET = 'max-upgrader/offline-codes/v1'

/** Алфавит Крокфорда: без I, L, O и U, чтобы код не путался при наборе. */
const A32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const enc = new TextEncoder()
const dec = new TextDecoder()

function base32(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) { out += A32[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += A32[(value << (5 - bits)) & 31]
  return out
}

function unbase32(s: string): Uint8Array | null {
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of s) {
    const i = A32.indexOf(ch)
    if (i < 0) return null
    value = (value << 5) | i
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return new Uint8Array(out)
}

export interface Reward {
  amount: number
  items: string[]
  label?: string
}

const sign = (payload: string) => hmacSha256Hex(SECRET, payload).slice(0, 5).toUpperCase()

/** Награда → код вида MX-XXXXXX-YYYYY, который работает на любом устройстве. */
export function makeCode(r: Reward): string {
  const idx = r.items
    .map((id) => ITEMS.findIndex((i) => i.id === id))
    .filter((i) => i >= 0)
  const payload = `${Math.max(0, Math.round(r.amount))}` + (idx.length ? ',' + idx.join(',') : '')
  return `MX-${base32(enc.encode(payload))}-${sign(payload)}`
}

/** Разбор кода. null — формат не наш или подпись не сходится. */
export function readCode(code: string): Reward | null {
  const m = /^MX-([0-9A-Z]+)-([0-9A-Z]{5})$/.exec(code.trim().toUpperCase())
  if (!m) return null
  const bytes = unbase32(m[1])
  if (!bytes) return null
  let payload: string
  try { payload = dec.decode(bytes) } catch { return null }
  if (!/^\d+(,\d+)*$/.test(payload)) return null
  if (sign(payload) !== m[2]) return null

  const parts = payload.split(',')
  const amount = Number(parts[0])
  if (!Number.isFinite(amount)) return null
  const items = parts.slice(1)
    .map((n) => ITEMS[Number(n)]?.id)
    .filter((id): id is string => !!id && !!ITEM_BY_ID[id])
  return { amount, items }
}
