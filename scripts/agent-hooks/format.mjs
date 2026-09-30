#!/usr/bin/env node
// afterFileEdit (Cursor) / PostToolUse Edit|Write (Claude Code): prettier on the edited file.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { projectDir, readInput, respond } from './lib.mjs'

const FORMATTABLE = /\.(tsx?|mts|cts|jsx?|mjs|cjs|css|scss|json|md|mdc|ya?ml)$/

const input = readInput()
const filePath = input.file_path ?? input.tool_input?.file_path

if (filePath && FORMATTABLE.test(filePath) && existsSync(filePath)) {
  const relative = path.relative(projectDir, filePath)
  const insideProject = !relative.startsWith('..') && !path.isAbsolute(relative)
  const prettier = path.join(projectDir, 'node_modules/.bin/prettier')
  if (insideProject && existsSync(prettier)) {
    spawnSync(prettier, ['--write', '--log-level', 'silent', '--ignore-unknown', filePath], {
      cwd: projectDir,
      stdio: 'ignore',
    })
  }
}

respond()
