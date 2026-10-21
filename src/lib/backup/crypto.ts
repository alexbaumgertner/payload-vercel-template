import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'

import type { Dump } from './dump'

/**
 * AES-256-GCM key: 32 bytes, base64, in `BACKUP_KEY` (`openssl rand -base64 32`). Keep it in the
 * password manager, not in the mailbox the copies go to: losing it loses every copy, and a key
 * next to the copies protects nothing. Null when unset; throws when set but malformed.
 */
export function backupKey(env: Record<string, string | undefined>): Buffer | null {
  const raw = env.BACKUP_KEY?.trim()
  if (!raw) return null
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('BACKUP_KEY must be 32 bytes in base64 (openssl rand -base64 32)')
  }
  return key
}

const IV_BYTES = 12
const TAG_BYTES = 16

/** gzip, then encrypt. File layout: iv (12) | auth tag (16) | ciphertext — self-contained. */
export function packDump(dump: Dump, key: Buffer): Buffer {
  const plain = gzipSync(Buffer.from(JSON.stringify(dump), 'utf8'))
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body])
}

/** Throws on a wrong key or a tampered file (GCM cannot tell the two apart). */
export function unpackDump(packed: Buffer, key: Buffer): Dump {
  const decipher = createDecipheriv('aes-256-gcm', key, packed.subarray(0, IV_BYTES))
  decipher.setAuthTag(packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))
  const plain = Buffer.concat([
    decipher.update(packed.subarray(IV_BYTES + TAG_BYTES)),
    decipher.final(),
  ])
  return JSON.parse(gunzipSync(plain).toString('utf8')) as Dump
}

export function backupFileName(siteName: string, createdAt: string): string {
  const slug = siteName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'backup'}-${createdAt.slice(0, 10)}.json.gz.enc`
}
