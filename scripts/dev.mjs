#!/usr/bin/env node
// `pnpm dev`: `next dev` on PORT. Next reads PORT only from the shell, not from .env files, so a
// checkout's port in .env.development.local (scripts/local-env.sh) would be ignored. Precedence
// matches Next's env loading: shell → .env.development.local → .env → 3000. Only PORT is read
// here; Next still loads every other variable itself.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { parse } from 'dotenv'

const fromFile = (file) => (existsSync(file) ? parse(readFileSync(file)).PORT : undefined)

const port = process.env.PORT || fromFile('.env.development.local') || fromFile('.env') || '3000'

const next = createRequire(import.meta.url).resolve('next/dist/bin/next')
const child = spawn(process.execPath, [next, 'dev', '--port', port, ...process.argv.slice(2)], {
  stdio: 'inherit',
})

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
