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
        // stubbing the Payload client and runtime keeps Node-only code (file-type, fs) out of the
        // browser bundle. Without the bare `payload` alias, a service importing a runtime value
        // (e.g. `APIError`) breaks Vite's dependency optimizer on a cold cache — i.e. on CI.
        // The regex matches only the bare specifier: `payload/shared` etc. stay real.
        resolve: {
          alias: [
            { find: '@/lib/payload', replacement: emptyModule },
            { find: /^payload$/, replacement: emptyModule },
          ],
        },
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
