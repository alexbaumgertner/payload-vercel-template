import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// Workers and the dev server share one database and port: same files Next loads in
// development (dotenv never overrides a set variable, so the shell, then the first file wins).
loadEnv({ path: ['.env.development.local', '.env'], quiet: true })

// Test workers open their own Payload connections (helpers seed data). Only the
// dev server may push the schema; concurrent pushes can block on an interactive prompt.
process.env.PAYLOAD_DB_PUSH = 'false'

const PORT = Number(process.env.E2E_PORT ?? process.env.PORT ?? 3000)
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
