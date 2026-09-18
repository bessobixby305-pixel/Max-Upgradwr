import { hmacSha256Hex, sha256Hex } from './sha256'

/** Цепочка серверных сидов: seed[i] = SHA256(seed[i+1]).
 *  Игроку заранее показывается хэш текущего сида, поэтому подменить
 *  результат задним числом невозможно — проверяется локально. */

export const randomSeed = (): string => {
  const a = new Uint8Array(32)
  crypto.getRandomValues(a)
  return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('')
}

export interface FairState {
  serverSeed: string
  serverSeedHash: string
  clientSeed: string
  nonce: number
  /** предыдущая, уже раскрытая цепочка — её можно проверить */
  revealed?: { serverSeed: string; hash: string; clientSeed: string; rounds: number }
}

export function newFairState(clientSeed?: string, prev?: FairState): FairState {
  const serverSeed = randomSeed()
  return {
    serverSeed,
    serverSeedHash: sha256Hex(serverSeed),
    clientSeed: clientSeed ?? randomSeed().slice(0, 16),
    nonce: 0,
    revealed: prev
      ? {
          serverSeed: prev.serverSeed,
          hash: prev.serverSeedHash,
          clientSeed: prev.clientSeed,
          rounds: prev.nonce,
        }
      : undefined,
  }
}

/** Детерминированный результат раунда в [0, 1). */
export function rollFloat(serverSeed: string, clientSeed: string, nonce: number, cursor = 0): number {
  const hex = hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:${cursor}`)
  return parseInt(hex.slice(0, 8), 16) / 0x100000000
}

/** Перемешивание массива по тому же сиду (для мин, битв и т.п.). */
export function seededShuffle<T>(arr: T[], serverSeed: string, clientSeed: string, nonce: number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rollFloat(serverSeed, clientSeed, nonce, i) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export { sha256Hex, hmacSha256Hex }
