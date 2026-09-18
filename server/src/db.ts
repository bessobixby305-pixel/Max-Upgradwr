import { PrismaClient } from '@prisma/client'

export const db = new PrismaClient()

/** BigInt не сериализуется в JSON, поэтому наружу отдаём числом.
 *  Баланс помещается в безопасное целое: предел — 9·10¹⁵. */
export const n = (v: bigint) => Number(v)
