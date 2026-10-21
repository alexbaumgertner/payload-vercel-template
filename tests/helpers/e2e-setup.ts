import { getPayload } from 'payload'

import { seedDemoChangelog } from '../../scripts/seed-demo'
import config from '../../src/payload.config'

/**
 * Playwright `globalSetup`: seeds the idempotent demo content once per run, before any worker
 * starts, so specs read it instead of seeding (and racing on) the same rows in parallel.
 * Playwright starts the web server first and waits for `/api/health` = 200, so the dev server has
 * already pushed the schema. Specs that need rows of their own still create and delete them.
 */
export default async function setup() {
  const payload = await getPayload({ config })
  try {
    await seedDemoChangelog(payload)
  } finally {
    await payload.destroy()
  }
}
