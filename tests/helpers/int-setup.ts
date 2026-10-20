import { config } from 'dotenv'

import { isolateTestEnv, pointAtTestDatabase } from './test-env'

// dotenv never overrides an already-set variable, so the shell, then the first file wins.
config({ path: ['.env.test.local', '.env'], quiet: true })

// Tests never send real mail and never touch the dev or production database.
isolateTestEnv(process.env)
pointAtTestDatabase(process.env)
