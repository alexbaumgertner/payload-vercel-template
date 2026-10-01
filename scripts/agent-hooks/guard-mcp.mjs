#!/usr/bin/env node
// beforeMCPExecution (Cursor) / PreToolUse mcp__.* (Claude Code): keep agents away from
// production data and deploy controls on the Neon and Vercel MCP servers.
import { readInput, respond, tool } from './lib.mjs'
import { checkMcpCall, parseClaudeToolName } from './policy.mjs'

const input = readInput()

const call =
  tool === 'claude'
    ? { ...parseClaudeToolName(input.tool_name), input: input.tool_input }
    : {
        server: input.mcp_server_name,
        url: input.mcp_server_url ?? input.url,
        tool: input.tool_name,
        input: input.tool_input,
      }

const verdict = checkMcpCall(call, process.env)

if (!verdict.allowed) {
  const message = `Blocked by project guard: ${verdict.reason}.`
  process.stderr.write(message)
  if (tool === 'cursor') {
    process.stdout.write(
      JSON.stringify({
        permission: 'deny',
        user_message: message,
        agent_message: `${message} Do not retry through another tool; ask the user.`,
      }),
    )
  }
  process.exit(2)
}

respond(tool === 'cursor' ? { permission: 'allow' } : undefined)
