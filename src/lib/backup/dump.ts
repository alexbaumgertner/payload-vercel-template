/**
 * Data-only database dump, read through Payload's `pg` pool.
 *
 * Why not `pg_dump`: Vercel functions have Node, no Postgres binaries. So this exports rows only.
 * The schema is not in the copy: it lives in the Payload config and migrations and is recreated
 * from the code (push locally, `payload migrate` on a fresh Neon branch) before a restore.
 *
 * This folder is the one place allowed to run raw SQL (docs/decisions.md): a backup has to see
 * every table, including Payload's own, which the Local API can't do.
 */
import { hostFingerprint } from '../database-url'

export const DUMP_VERSION = 1

/**
 * Short-lived, lock or cache rows: nothing worth restoring, and some (sessions, login codes) are
 * credentials. `payload_migrations` only records what the schema tool did on the source; the
 * restore target gets its own entries from push or `payload migrate`.
 */
export const SKIP_TABLES: ReadonlySet<string> = new Set([
  'payload_migrations',
  'auth_codes',
  'users_sessions',
  'payload_kv',
  'payload_locked_documents',
  'payload_locked_documents_rels',
])

export type Dump = {
  version: number
  createdAt: string
  /** Fingerprint of the source host: shows where a copy came from without the URL. */
  source: string
  /** Alphabetical; the restore works out the insert order from the target's foreign keys. */
  tables: Array<{ name: string; rows: Record<string, unknown>[] }>
  sequences: Array<{ name: string; value: string }>
}

/** The subset of a `pg` client this folder needs (`payload.db.pool.connect()` provides it). */
export type Queryable = {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[] }>
}

export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`

/**
 * Reads every table in one REPEATABLE READ, READ ONLY transaction, so the copy is a consistent
 * snapshot even while the app keeps writing.
 */
export async function createDump(
  client: Queryable,
  databaseUrl: string,
  now: Date = new Date(),
): Promise<Dump> {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  try {
    const { rows: tableRows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
    )
    const names = tableRows.map((row) => row.table_name).filter((name) => !SKIP_TABLES.has(name))

    const tables: Dump['tables'] = []
    for (const name of names) {
      // Names come from information_schema, not from outside; quoted anyway.
      const { rows } = await client.query(`SELECT * FROM ${quoteIdent(name)}`)
      tables.push({ name, rows })
    }

    // Without the sequences the first insert after a restore collides with an existing id. Only
    // sequences owned by a dumped table (serial or identity columns).
    const { rows: sequences } = await client.query<{
      name: string
      table: string
      value: string | null
    }>(
      `SELECT seq.relname AS name, tbl.relname AS "table", ps.last_value::text AS value
         FROM pg_class seq
         JOIN pg_depend dep ON dep.objid = seq.oid AND dep.deptype IN ('a', 'i')
         JOIN pg_class tbl ON tbl.oid = dep.refobjid
         JOIN pg_sequences ps ON ps.schemaname = 'public' AND ps.sequencename = seq.relname
        WHERE seq.relkind = 'S'
        ORDER BY seq.relname`,
    )

    await client.query('COMMIT')
    return {
      version: DUMP_VERSION,
      createdAt: now.toISOString(),
      source: hostFingerprint(databaseUrl),
      tables,
      sequences: sequences.flatMap((seq) =>
        seq.value === null || !names.includes(seq.table)
          ? []
          : [{ name: seq.name, value: seq.value }],
      ),
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  }
}

export function totalRows(dump: Pick<Dump, 'tables'>): number {
  return dump.tables.reduce((sum, table) => sum + table.rows.length, 0)
}

/** What the copy contains, for the email body and `backup:verify`. */
export function summarize(dump: Dump): string {
  const lines = dump.tables
    .filter((table) => table.rows.length > 0)
    .map((table) => `  ${table.name}: ${table.rows.length}`)
  return [`Rows: ${totalRows(dump)}`, ...lines, `Sequences: ${dump.sequences.length}`].join('\n')
}

/**
 * Parents before children. Foreign-key checks can't be switched off during a restore (that needs
 * a superuser, which Neon doesn't give), so the insert order must be right. Self-references are
 * ignored; a cycle is appended as-is — the restore avoids cycles by ordering on NOT NULL keys only.
 */
export function orderTables(
  tables: string[],
  foreignKeys: Array<{ child: string; parent: string }>,
): string[] {
  const deps = new Map(tables.map((table) => [table, new Set<string>()]))
  for (const { child, parent } of foreignKeys) {
    if (child === parent) continue
    if (deps.has(parent)) deps.get(child)?.add(parent)
  }

  const ordered: string[] = []
  const placed = new Set<string>()
  while (placed.size < tables.length) {
    const ready = tables.filter(
      (table) =>
        !placed.has(table) && [...(deps.get(table) ?? [])].every((parent) => placed.has(parent)),
    )
    if (ready.length === 0) {
      ordered.push(...tables.filter((table) => !placed.has(table)))
      break
    }
    for (const table of ready) {
      ordered.push(table)
      placed.add(table)
    }
  }
  return ordered
}
