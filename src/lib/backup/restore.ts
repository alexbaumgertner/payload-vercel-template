import { DUMP_VERSION, type Dump, orderTables, type Queryable, quoteIdent } from './dump'

const INSERT_CHUNK_ROWS = 200

type ForeignKey = { child: string; column: string; parent: string; nullable: boolean }

const FOREIGN_KEY_COLUMNS_SQL = `
  SELECT tc.table_name AS child, kcu.column_name AS "column", ccu.table_name AS parent,
         (c.is_nullable = 'YES') AS nullable
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.columns c
      ON c.table_schema = tc.table_schema AND c.table_name = tc.table_name
     AND c.column_name = kcu.column_name
   WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`

/**
 * Inserts a dump into a database whose schema already exists and whose tables are empty.
 *
 * - Refuses a dump version it doesn't know: restoring blind is worse than not restoring.
 * - Refuses if any table in the dump already has rows (or is missing), before inserting
 *   anything — a restore never merges into or duplicates live data.
 * - One transaction: a failure leaves the target untouched.
 * - Insert order follows the NOT NULL foreign keys (those can't form a cycle, or the data could
 *   not exist); nullable foreign keys are inserted as NULL and filled in afterwards, which breaks
 *   any cycle a schema may have.
 * - Sequences are reset, so the next insert doesn't collide with a restored id.
 */
export async function restoreDump(
  client: Queryable,
  dump: Dump,
): Promise<{ tables: Array<{ name: string; rows: number }> }> {
  if (dump.version !== DUMP_VERSION) {
    throw new Error(
      `Backup version ${dump.version}, this code reads ${DUMP_VERSION}. Not restoring.`,
    )
  }

  await client.query('BEGIN')
  try {
    const { rows: existingTables } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    )
    const present = new Set(existingTables.map((row) => row.table_name))
    for (const table of dump.tables) {
      if (!present.has(table.name)) {
        throw new Error(
          `Table ${table.name} does not exist in the target. Create the schema first ` +
            '(push locally, `pnpm payload migrate` on a remote database) with code from the backup date.',
        )
      }
      const { rows } = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ${quoteIdent(table.name)}`,
      )
      if ((rows[0]?.n ?? 0) > 0) {
        throw new Error(`Table ${table.name} is not empty; restore only into an empty database`)
      }
    }

    const { rows: foreignKeys } = await client.query<ForeignKey>(FOREIGN_KEY_COLUMNS_SQL)
    const deferred = new Map<string, Set<string>>()
    for (const fk of foreignKeys) {
      if (!fk.nullable) continue
      if (!deferred.has(fk.child)) deferred.set(fk.child, new Set())
      deferred.get(fk.child)?.add(fk.column)
    }

    const byName = new Map(dump.tables.map((table) => [table.name, table]))
    const order = orderTables(
      [...byName.keys()],
      foreignKeys.filter((fk) => !fk.nullable),
    )

    const report: Array<{ name: string; rows: number }> = []
    for (const tableName of order) {
      const table = byName.get(tableName)
      if (!table) continue
      report.push({ name: table.name, rows: table.rows.length })
      const firstRow = table.rows[0]
      if (!firstRow) continue

      const { rows: columns } = await client.query<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1`,
        [table.name],
      )
      const types = new Map(columns.map((column) => [column.column_name, column.data_type]))
      const later = deferred.get(table.name) ?? new Set<string>()
      const keys = Object.keys(firstRow)

      for (let start = 0; start < table.rows.length; start += INSERT_CHUNK_ROWS) {
        const values: unknown[] = []
        const tuples = table.rows.slice(start, start + INSERT_CHUNK_ROWS).map((row) => {
          const params = keys.map((key) => {
            values.push(later.has(key) ? null : encode(types.get(key), row[key]))
            return `$${values.length}`
          })
          return `(${params.join(', ')})`
        })
        await client.query(
          `INSERT INTO ${quoteIdent(table.name)} (${keys.map(quoteIdent).join(', ')})
           VALUES ${tuples.join(', ')}`,
          values,
        )
      }
    }

    // Second pass: every row exists now, so nullable keys can point anywhere.
    for (const [tableName, laterColumns] of deferred) {
      const table = byName.get(tableName)
      const firstRow = table?.rows[0]
      if (!table || !firstRow) continue
      const columns = [...laterColumns].filter((column) => column in firstRow)
      if (columns.length === 0) continue
      const assignments = columns.map((column, i) => `${quoteIdent(column)} = $${i + 1}`).join(', ')
      for (const row of table.rows) {
        if (columns.every((column) => row[column] === null || row[column] === undefined)) continue
        await client.query(
          `UPDATE ${quoteIdent(tableName)} SET ${assignments} WHERE "id" = $${columns.length + 1}`,
          [...columns.map((column) => row[column] ?? null), row.id],
        )
      }
    }

    for (const sequence of dump.sequences) {
      await client.query('SELECT setval($1, $2::bigint, true)', [
        `public.${quoteIdent(sequence.name)}`,
        sequence.value,
      ])
    }

    await client.query('COMMIT')
    return { tables: report }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  }
}

/**
 * JSON round-trips lose Postgres types. `pg` would send a JS array as a Postgres array literal,
 * which a json/jsonb column rejects, so JSON columns are stringified. A `bytea` value came back
 * from JSON as `{ type: 'Buffer', data: [...] }`. Everything else (dates as ISO strings, numerics
 * as strings) Postgres parses itself.
 */
function encode(dataType: string | undefined, value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (dataType === 'json' || dataType === 'jsonb') return JSON.stringify(value)
  if (dataType === 'bytea' && isSerializedBuffer(value)) return Buffer.from(value.data)
  return value
}

function isSerializedBuffer(value: unknown): value is { type: 'Buffer'; data: number[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'Buffer' &&
    'data' in value &&
    Array.isArray(value.data)
  )
}
