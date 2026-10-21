import { config } from 'dotenv'

// Same files and order as `next dev` (shell → .env.development.local → .env; dotenv never
// overrides a set variable), so scripts hit the checkout's own database (scripts/local-env.sh).
// Import it first: src/lib/env.ts parses process.env when it is imported.
config({ path: ['.env.development.local', '.env'], quiet: true })
