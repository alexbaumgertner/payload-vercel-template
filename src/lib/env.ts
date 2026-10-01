import { z } from 'zod'

const serverEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
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
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

function parseEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env)
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

export const env = parseEnv()
