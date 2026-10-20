// Check a mailed backup without restoring it: does my key open it, and what is inside?
//
//   BACKUP_KEY='…' pnpm backup:verify ~/Downloads/<site>-2026-10-20.json.gz.enc
//
// Touches no database. Worth doing by hand every few months: tests catch broken code, not a copy
// that quietly became incomplete after a schema change.
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'

import { backupKey, unpackDump } from '../src/lib/backup/crypto'
import { DUMP_VERSION, type Dump, summarize } from '../src/lib/backup/dump'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

async function main() {
  const file = process.argv.slice(2).find((arg) => arg !== '--')
  if (!file) fail('Usage: BACKUP_KEY=… pnpm backup:verify <file.json.gz.enc>')

  let key: Buffer | null
  try {
    key = backupKey(process.env)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
  if (!key)
    fail(
      `BACKUP_KEY is not set. Take it from the password manager:\n  BACKUP_KEY='…' pnpm backup:verify ${file}`,
    )

  let packed: Buffer
  try {
    packed = await readFile(file.replace(/^~(?=\/)/, homedir()))
  } catch (error) {
    fail(
      `Cannot read ${file}: ${error instanceof Error ? error.message : error}. Download the attachment first.`,
    )
  }

  let dump: Dump
  try {
    dump = unpackDump(packed, key)
  } catch {
    fail('Cannot decrypt: wrong key or damaged file (AES-GCM cannot tell which).')
  }

  if (dump.version !== DUMP_VERSION) {
    console.warn(`Warning: backup version ${dump.version}, this code reads ${DUMP_VERSION}.`)
  }
  const ageHours = Math.round((Date.now() - Date.parse(dump.createdAt)) / 36e5)
  console.log(`\nBackup ${dump.createdAt} (${ageHours} h ago), source fingerprint ${dump.source}\n`)
  console.log(summarize(dump))

  // A readable but empty copy restores nothing.
  const users = dump.tables.find((table) => table.name === 'users')?.rows.length ?? 0
  if (users === 0) fail('\nNo users in this backup: it would restore nothing useful.')
  console.log(
    '\nReadable and not empty. Restore into an empty database: pnpm backup:restore <file>',
  )
}

void main()
