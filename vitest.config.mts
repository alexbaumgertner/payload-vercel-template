import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const emptyModule = fileURLToPath(new URL('./tests/helpers/empty-module.ts', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: { 'server-only': emptyModule },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['tests/unit/**/*.unit.spec.{ts,tsx}'],
        },
      },
      {
        extends: true,
        // Server actions are vi.mock'ed in browser tests, but Vite still crawls their imports;
        // stubbing the Payload client keeps Node-only code out of the browser bundle.
        resolve: { alias: { '@/lib/payload': emptyModule } },
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.browser.spec.{ts,tsx}'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: !process.env.BROWSER_HEADED,
            instances: [{ browser: 'chromium' }],
            screenshotFailures: false,
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'int',
          environment: 'node',
          include: ['tests/int/**/*.int.spec.ts'],
          setupFiles: ['./tests/helpers/int-setup.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
