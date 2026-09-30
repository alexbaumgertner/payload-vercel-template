import { config } from 'dotenv'

config({ quiet: true })

// Integration tests must never touch the dev or production database.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://app:app@127.0.0.1:5432/app_test'
