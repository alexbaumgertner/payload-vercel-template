import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

// Tests run without BLOB_READ_WRITE_TOKEN, like local dev where migrations are generated. The
// Blob plugin's columns must exist anyway, or production (token set) queries columns that no
// migration created.
describe('media schema without a Blob token', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    await payload.destroy()
  })

  it('has the Blob plugin fields', () => {
    const names = payload.collections.media.config.flattenedFields.map((field) => field.name)
    expect(names).toEqual(expect.arrayContaining(['prefix', '_objectKey']))
  })

  it('has the matching columns in the pushed database', async () => {
    const { rows } = await payload.db.pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'media'`,
    )
    const columns = rows.map((row) => row.column_name)
    expect(columns).toEqual(expect.arrayContaining(['prefix', '_objectkey']))
  })
})
