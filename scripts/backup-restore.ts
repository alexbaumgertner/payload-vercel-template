import './load-env'

// Restore a mailed backup into an EMPTY database.
//
//   createdb app_restore
//   DATABASE_URL=postgresql://…/app_restore BACKUP_KEY='…' pnpm backup:restore <file.json.gz.enc>
//
// Locally, starting Payload pushes the schema into the empty database first. A remote target (a
// fresh Neon branch for a real recovery) needs the schema from migrations first and the human-only
// opt-in — see docs/runbooks/backup-restore.md. Rows go in foreign-key order in one transaction,
// sequences are reset; any non-empty table aborts the whole restore.
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'

import { getPayload } from 'payload'

import { backupKey, unpackDump } from '../src/lib/backup/crypto'
import { restoreDump } from '../src/lib/backup/restore'
import { assertLocalDatabaseForScript } from '../src/lib/database-target'
import { env } from '../src/lib/env'
import config from '../src/payload.config'

async function main() {
  assertLocalDatabaseForScript('backup:restore', { ...process.env, DATABASE_URL: env.DATABASE_URL })

  const file = process.argv.slice(2).find((arg) => arg !== '--')
  if (!file) throw new Error('Usage: BACKUP_KEY=… pnpm backup:restore <file.json.gz.enc>')
  const key = backupKey(process.env)
  if (!key) throw new Error('BACKUP_KEY is not set. Take it from the password manager.')

  const dump = unpackDump(await readFile(file.replace(/^~(?=\/)/, homedir())), key)
  const payload = await getPayload({ config })
  const client = await payload.db.pool.connect()
  try {
    const { tables } = await restoreDump(client, dump)
    const rows = tables.reduce((sum, table) => sum + table.rows, 0)
    console.log(
      `Restored ${rows} rows into ${tables.length} tables from the backup of ${dump.createdAt}.`,
    )
    for (const table of tables.filter((t) => t.rows > 0))
      console.log(`  ${table.name}: ${table.rows}`)
  } finally {
    client.release()
  }
}

// Payload keeps background handles (DB pool, jobs) open, so exit explicitly.
main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error('backup:restore failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  },
)
