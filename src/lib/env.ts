import { z } from 'zod'

const serverEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  PAYLOAD_SECRET: z.string().min(16, 'PAYLOAD_SECRET must be at least 16 characters'),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM_ADDRESS: z.email().default('onboarding@resend.dev'),
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:43127'),
  // Dev-only schema push (never in production). Off for extra processes sharing a DB
  // with the dev server, e.g. Playwright workers: concurrent pushes can hang on a prompt.
  PAYLOAD_DB_PUSH: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
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
