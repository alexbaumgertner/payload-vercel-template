#!/usr/bin/env node
// beforeShellExecution (Cursor) / PreToolUse Bash (Claude Code): block destructive commands.
import { readInput, respond, tool } from './lib.mjs'

const RULES = [
  {
    pattern: /\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\$HOME)(\s|$)/i,
    reason: 'recursive delete of a root/home path',
  },
  {
    pattern: /\bgit\s+push\b.*(--force\b|-f\b)(?!-with-lease)/,
    reason: 'force push (use --force-with-lease on your own branch)',
  },
  {
    pattern: /\bgit\s+reset\s+--hard\s+origin\//,
    reason: 'hard reset to remote discards local work',
  },
  { pattern: /\b(drop\s+(database|schema|table)|truncate\s+table)\b/i, reason: 'destructive SQL' },
  {
    pattern: /\bpayload\s+migrate:(fresh|reset)\b|\bmigrate:(fresh|reset)\b/,
    reason: 'drops all data — run it yourself if you really mean it',
  },
  {
    pattern: /postgres(ql)?:\/\/\S*neon\.tech/i,
    reason: 'direct access to a Neon (production) database',
  },
  {
    pattern: /\bvercel\s+(--prod|deploy\s+--prod|promote|rollback)\b/,
    reason: 'production deploys are done by a human',
  },
  { pattern: /\bvercel\s+env\s+(pull|rm)\b/, reason: 'touches production secrets' },
]

const input = readInput()
const command = input.command ?? input.tool_input?.command ?? ''
const hit = RULES.find((rule) => rule.pattern.test(command))

if (hit) {
  const message = `Blocked by project guard: ${hit.reason}. Command: ${command}`
  process.stderr.write(message)
  if (tool === 'cursor') {
    process.stdout.write(
      JSON.stringify({
        permission: 'deny',
        user_message: message,
        agent_message: `${message}. Ask the user to run it manually if it is really needed.`,
      }),
    )
  }
  process.exit(2)
}

respond(tool === 'cursor' ? { permission: 'allow' } : undefined)
