#!/usr/bin/env node
// beforeShellExecution (Cursor) / PreToolUse Bash (Claude Code): block destructive commands.
import { readInput, respond, tool } from './lib.mjs'
import { checkShellCommand } from './policy.mjs'

const input = readInput()
const command = input.command ?? input.tool_input?.command ?? ''
const verdict = checkShellCommand(command)

if (!verdict.allowed) {
  const message = `Blocked by project guard: ${verdict.reason}. Command: ${command}`
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
