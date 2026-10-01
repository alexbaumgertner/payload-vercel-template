import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

// Test workers open their own Payload connections (helpers seed data). Only the
// dev server may push the schema; concurrent pushes can block on an interactive prompt.
process.env.PAYLOAD_DB_PUSH = 'false'

const PORT = Number(process.env.E2E_PORT ?? 43127)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  globalTimeout: process.env.CI ? 20 * 60_000 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm exec cross-env NODE_OPTIONS=--no-deprecation PAYLOAD_DB_PUSH=true next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
