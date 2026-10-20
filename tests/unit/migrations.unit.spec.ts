// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import type { SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, test, vi } from 'vitest'

/**
 * The committed migrations know about every collection — checked statically, from the migration
 * text, without a database.
 *
 * Why static: a schema comparison against a live database proves nothing locally, because the dev
 * server's push has already created whatever the config needs. A real incident in a sibling
 * project: a new collection got its own tables in a migration, but not its `<slug>_id` column in
 * `payload_locked_documents_rels` — Payload queries that column on *every* write to *any*
 * collection, so production failed on saving a user profile, not on the new collection. Push hid
 * it in development. The CI job `migrations` (empty database, push off) covers the other half:
 * that the SQL actually runs.
 *
 * The replay below reads only each `up()` and is deliberately simple. If it misreads a
 * hand-written migration, fix the migration's formatting or extend the parser — don't weaken it.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), 'src/migrations')

/** `payload migrate` reads the directory itself (not index.ts), sorted by file name. */
const migrationNames = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.ts') && file !== 'index.ts')
  .map((file) => file.replace(/\.ts$/, ''))
  .sort()

const upSql = (name: string) => {
  const source = readFileSync(path.join(MIGRATIONS_DIR, `${name}.ts`), 'utf8')
  return source.split(/export async function down/)[0] ?? ''
}

type Schema = { tables: Set<string>; columns: Map<string, Set<string>>; problems: string[] }

const columnsOf = (schema: Schema, table: string) => {
  const columns = schema.columns.get(table) ?? new Set<string>()
  schema.columns.set(table, columns)
  return columns
}

/** Applies CREATE/DROP TABLE and ADD/DROP COLUMN in apply order; flags references to missing tables. */
function replay(names: string[]): Schema {
  const schema: Schema = { tables: new Set(), columns: new Map(), problems: [] }
  for (const name of names) {
    const sql = upSql(name)
    const statement =
      /CREATE TABLE(?: IF NOT EXISTS)? "(\w+)" \(([\s\S]*?)\n\s*\);|DROP TABLE(?: IF EXISTS)? "(\w+)"|ALTER TABLE "(\w+)" ([^;]*);/g
    for (const match of sql.matchAll(statement)) {
      const [, created, body, dropped, altered, change] = match
      if (created && body !== undefined) {
        schema.tables.add(created)
        for (const column of body.matchAll(/^\s*"(\w+)"/gm))
          columnsOf(schema, created).add(column[1]!)
      } else if (dropped) {
        schema.tables.delete(dropped)
        schema.columns.delete(dropped)
      } else if (altered && change !== undefined) {
        if (!schema.tables.has(altered)) {
          schema.problems.push(`${name}: ALTER TABLE "${altered}" before it is created`)
        }
        for (const [, column] of change.matchAll(/ADD COLUMN(?: IF NOT EXISTS)? "(\w+)"/g)) {
          columnsOf(schema, altered).add(column!)
        }
        for (const [, column] of change.matchAll(/DROP COLUMN(?: IF EXISTS)? "(\w+)"/g)) {
          columnsOf(schema, altered).delete(column!)
        }
        for (const [, target] of change.matchAll(/REFERENCES "public"\."(\w+)"/g)) {
          if (!schema.tables.has(target!)) {
            schema.problems.push(`${name}: "${altered}" references "${target}" before it exists`)
          }
        }
      }
    }
  }
  return schema
}

// Payload's own table naming for a slug (to-snake-case), unless the collection sets dbName.
const tableName = (collection: { slug: string; dbName?: unknown }) =>
  typeof collection.dbName === 'string'
    ? collection.dbName
    : collection.slug
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/-/g, '_')
        .toLowerCase()

let config: SanitizedConfig

beforeAll(async () => {
  // Loading the config builds the adapter but never connects; env.ts only needs valid values.
  vi.stubEnv('DATABASE_URL', 'postgresql://app:app@127.0.0.1:5432/never_connected')
  vi.stubEnv('PAYLOAD_SECRET', 'unit-test-secret-never-used')
  config = await (await import('@/payload.config')).default
})

describe('migrations cover every collection', () => {
  test('each collection (including Payload’s own) has its table', () => {
    const { tables } = replay(migrationNames)
    const missing = config.collections.map(tableName).filter((table) => !tables.has(table))
    expect(missing, 'tables no migration creates — run `pnpm migrate:create <name>`').toEqual([])
  })

  test('each collection has its `<slug>_id` column in payload_locked_documents_rels', () => {
    const columns = replay(migrationNames).columns.get('payload_locked_documents_rels')
    const missing = config.collections
      .filter((collection) => !collection.slug.startsWith('payload-'))
      .map((collection) => `${tableName(collection)}_id`)
      .filter((column) => !columns?.has(column))
    expect(
      missing,
      'Payload reads these on every write to any collection; without them all writes fail',
    ).toEqual([])
  })

  test('each auth collection has its `<slug>_id` column in payload_preferences_rels', () => {
    const columns = replay(migrationNames).columns.get('payload_preferences_rels')
    const missing = config.collections
      .filter((collection) => collection.auth)
      .map((collection) => `${tableName(collection)}_id`)
      .filter((column) => !columns?.has(column))
    expect(missing).toEqual([])
  })
})

describe('migration order', () => {
  test('names are Payload timestamps, so file-name order is creation order', () => {
    for (const name of migrationNames) expect(name).toMatch(/^\d{8}_\d{6}_[a-z0-9_]+$/)
    const stamps = migrationNames.map((name) => name.slice(0, 15))
    expect(new Set(stamps).size, 'two migrations share a timestamp').toBe(stamps.length)
  })

  test('replayed in file-name order, nothing alters or references a table before it exists', () => {
    expect(replay(migrationNames).problems).toEqual([])
  })

  test('index.ts lists every migration, in apply order', async () => {
    const { migrations } = await import('@/migrations')
    expect(migrations.map((migration) => migration.name)).toEqual(migrationNames)
  })
})
