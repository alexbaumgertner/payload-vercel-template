#!/usr/bin/env node
// Stop (Codex, .codex/hooks.json): refuse to finish while `pnpm check` fails.
// Codex wants JSON or nothing on stdout, so all output goes to stderr; exit 2 makes Codex
// continue with stderr as the next prompt. One retry only, like stop-typecheck.mjs.
import { spawnSync } from 'node:child_process'

import { projectDir, readInput, respond } from './lib.mjs'

const input = readInput()
if (input.stop_hook_active) respond()

const result = spawnSync('pnpm', ['-s', 'check'], { cwd: projectDir, encoding: 'utf8' })
if (result.status === 0) respond()

const output = `${result.stdout}${result.stderr}`.trim().split('\n').slice(-40).join('\n')
process.stderr.write(`pnpm check failed. Fix it before finishing:\n\n${output}`)
process.exit(2)
