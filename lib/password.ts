import { randomBytes, scrypt, timingSafeEqual } from 'crypto'

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export function hashPassword(password: string) {
  const salt = randomBytes(16)
  const normalized = password.normalize('NFKC')
  return new Promise<string>((resolve, reject) => {
    scrypt(normalized, salt, 32, SCRYPT, (error, key) => {
      if (error) reject(error)
      else resolve(`scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`)
    })
  })
}

export function verifyPassword(password: string, stored: string) {
  const [kind, saltB64, keyB64] = stored.split('$')
  if (kind !== 'scrypt' || !saltB64 || !keyB64) return Promise.resolve(false)
  const salt = Buffer.from(saltB64, 'base64url')
  const expected = Buffer.from(keyB64, 'base64url')
  const normalized = password.normalize('NFKC')
  return new Promise<boolean>((resolve, reject) => {
    scrypt(normalized, salt, expected.length, SCRYPT, (error, key) => {
      if (error) reject(error)
      else resolve(key.length === expected.length && timingSafeEqual(key, expected))
    })
  })
}
