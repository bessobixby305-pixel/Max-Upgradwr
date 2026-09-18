import { createHmac, timingSafeEqual } from 'node:crypto'

const b64 = (b: Buffer | string) =>
  Buffer.from(b).toString('base64url')

function sign(data: string, secret: string) {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

export interface Claims {
  sub: string
  role: 'PLAYER' | 'ADMIN'
  exp: number
}

export function issue(claims: Omit<Claims, 'exp'>, secret: string, ttlSec: number): string {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64(JSON.stringify({
    ...claims,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  }))
  return `${header}.${payload}.${sign(`${header}.${payload}`, secret)}`
}

export function verify(token: string, secret: string): Claims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const expected = sign(`${parts[0]}.${parts[1]}`, secret)
  const a = Buffer.from(parts[2])
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Claims
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null
    return claims
  } catch {
    return null
  }
}
