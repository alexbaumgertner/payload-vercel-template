#!/usr/bin/env node
// stop (Cursor) / Stop (Claude Code): refuse to finish while TypeScript is broken.
import { spawnSync } from 'node:child_process'

import { projectDir, readInput, respond, tool } from './lib.mjs'

const input = readInput()

if (tool === 'cursor' && input.status && input.status !== 'completed') respond({})
if (tool === 'claude' && input.stop_hook_active) respond()
// Cursor can load .claude/settings.json too; its native stop hook already covers this.
if (tool === 'claude' && process.env.CURSOR_VERSION) respond()

const changed = spawnSync('git', ['status', '--porcelain'], { cwd: projectDir, encoding: 'utf8' })
const touchedTs = /\.(tsx?|mts)$/m.test(changed.stdout ?? '')
if (!touchedTs) respond(tool === 'cursor' ? {} : undefined)

const result = spawnSync('pnpm', ['-s', 'typecheck'], { cwd: projectDir, encoding: 'utf8' })
if (result.status === 0) respond(tool === 'cursor' ? {} : undefined)

const errors = `${result.stdout}${result.stderr}`.trim().split('\n').slice(0, 40).join('\n')
const message = `pnpm typecheck failed. Fix these errors before finishing:\n\n${errors}`

if (tool === 'cursor') respond({ followup_message: message })
process.stderr.write(message)
process.exit(2)
