import { readFileSync } from 'node:fs'

export const tool = process.argv.includes('--tool=claude') ? 'claude' : 'cursor'

export const projectDir =
  process.env.CURSOR_PROJECT_DIR ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd()

export function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    return {}
  }
}

export function respond(json) {
  if (json) process.stdout.write(JSON.stringify(json))
  process.exit(0)
}
