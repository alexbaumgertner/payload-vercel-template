import { z } from 'zod'

import { selectDatabaseUrl } from './database-url'

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ })

const serverEnvSchema = z.object({
  // The connection string the app uses: DATABASE_URI → DATABASE_URL → POSTGRES_URL, with weak
  // sslmodes upgraded to verify-full (see src/lib/database-url.ts). Always read this one.
  DATABASE_URL: postgresUrl,
  // Optional overrides/fallbacks, only consulted by the selection above.
  DATABASE_URI: postgresUrl.optional(),
  POSTGRES_URL: postgresUrl.optional(),
  PAYLOAD_SECRET: z.string().min(16, 'PAYLOAD_SECRET must be at least 16 characters'),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM_ADDRESS: z.email().default('onboarding@resend.dev'),
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
  // Dev-only schema push (never in production). Off for extra processes sharing a DB
  // with the dev server, e.g. Playwright workers: concurrent pushes can hang on a prompt.
  PAYLOAD_DB_PUSH: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  // Product analytics: 'none' (default) sends nothing. See src/lib/analytics.ts.
  ANALYTICS_PROVIDER: z.enum(['none', 'vercel']).default('none'),
  // Error monitoring is off (no SDK loaded) unless SENTRY_DSN is set. See src/lib/monitoring.
  SENTRY_DSN: z.url().optional(),
  SENTRY_ENVIRONMENT: z.string().min(1).optional(),
  // Build-time only, for source-map upload from the Vercel build.
  SENTRY_ORG: z.string().min(1).optional(),
  SENTRY_PROJECT: z.string().min(1).optional(),
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  // Read by tooling, not the app (listed so every variable has one home). See "Parallel
  // checkouts" in AGENTS.md: scripts/dev.mjs, playwright.config.ts, tests/helpers/int-setup.ts,
  // docker-compose.yml.
  PORT: z.string().regex(/^\d+$/).optional(),
  E2E_PORT: z.string().regex(/^\d+$/).optional(),
  TEST_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
  POSTGRES_HOST_PORT: z.string().regex(/^\d+$/).optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  // `KEY=` in an env file means "unset", not "empty string": defaults and `.optional()` apply.
  const raw = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''))
  const result = serverEnvSchema.safeParse({
    ...raw,
    DATABASE_URL: selectDatabaseUrl(raw)?.url,
  })
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

export const env = parseServerEnv(process.env)
