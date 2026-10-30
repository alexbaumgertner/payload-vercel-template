#!/usr/bin/env node
// Risk tier of a change, set from the files it touches — not from who (or what) wrote it.
//
//   node scripts/risk-tier.mjs                 # this branch vs main, plus uncommitted work
//   node scripts/risk-tier.mjs --base origin/main --json
//   node scripts/risk-tier.mjs --base origin/main --head FETCH_HEAD --check-signoff
//                                              # CI: High needs the human sign-off line for the head commit
//
// Low    — docs, tests, copy only. Automated review + CI are enough.
// Medium — ordinary product code. Read the reviewer's findings and the evidence.
// High   — auth, access, schema, migrations, CI, agent guards, security headers, env, deploy config,
//          dependencies. A human reads the diff of these files; see REVIEW.md and AGENTS.md → Code review.
//
// Start strict, loosen with evidence: move a path down a tier only after its misses stay at zero
// in docs/review-misses.md.

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** Paths where a person always reads the diff. First match wins; the label goes into the report. */
export const HIGH = [
  [/^src\/features\/auth\//, 'auth'],
  [/^src\/access\//, 'access control'],
  [/^src\/collections\//, 'collections (schema + access)'],
  [/^src\/migrations\//, 'migrations'],
  [/^src\/payload\.config\.ts$/, 'Payload config'],
  [
    /^src\/lib\/(security-headers|env|database-target|database-url|cron-auth|mail-gate)\.ts$/,
    'security-sensitive lib',
  ],
  [/^src\/lib\/backup\//, 'backups'],
  [/^src\/proxy\.ts$/, 'request proxy'],
  [/^(next\.config\.ts|vercel\.json|src\/instrumentation(-client)?\.ts)$/, 'deploy/runtime config'],
  [/^\.github\/workflows\//, 'CI workflows'],
  [/^\.github\/dependabot\.yml$/, 'dependency automation'],
  [/^scripts\/agent-hooks\//, 'agent guards'],
  [/^scripts\/risk-tier\.mjs$/, 'this classifier'],
  [/^\.claude\/settings(\.local)?\.json$|^\.cursor\/hooks\.json$|^\.codex\//, 'agent permissions'],
  [/^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.nvmrc)$/, 'dependencies/runtime'],
  [/^\.env\.example$/, 'env vars'],
]

/** Paths that alone never need a person: docs, tests, copy, generated types. */
export const LOW = [
  /\.md$/,
  /^docs\//,
  /^tests\//,
  /^messages\/[^/]+\.json$/,
  /^src\/payload-types\.ts$/,
  /^\.github\/pull_request_template\.md$/,
  /^\.vscode\//,
]

/**
 * @param {string[]} files paths relative to the repo root
 * @returns {{ tier: 'Low' | 'Medium' | 'High', high: { file: string, why: string }[], medium: string[] }}
 */
export function classify(files) {
  const high = []
  const medium = []
  for (const file of files) {
    const hit = HIGH.find(([re]) => re.test(file))
    if (hit) high.push({ file, why: hit[1] })
    else if (!LOW.some((re) => re.test(file))) medium.push(file)
  }
  const tier = high.length ? 'High' : medium.length ? 'Medium' : 'Low'
  return { tier, high, medium }
}

/**
 * The PR description as GitHub renders it, minus what a reader doesn't see as a checklist: fenced code blocks
 * (```/~~~), HTML comments and indented code. Pasted logs and the template's commented example live there.
 * @param {string} body
 */
export function renderedText(body) {
  const withoutComments = body.replace(/<!--[\s\S]*?(?:-->|$)/g, '')
  const out = []
  let fence = null
  for (const line of withoutComments.split(/\r?\n/)) {
    const open = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (fence) {
      if (
        open &&
        open[1][0] === fence[0] &&
        open[1].length >= fence.length &&
        !line.trim().slice(open[1].length)
      )
        fence = null
      continue
    }
    if (open) {
      fence = open[1]
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

/**
 * A High-risk PR needs a ticked checklist line written by the human, naming the head commit:
 *   - [x] Human read the High-risk diff at <sha>
 * The SHA ties the sign-off to one commit: any later push (an agent's fix, a merge) voids it. Only a rendered
 * list item counts (at most 3 spaces of indent) — not one inside a code block, an HTML comment or a quote,
 * so pasting this script's own failure message into the Evidence block can't sign anything off.
 * @param {string | undefined} body PR description
 * @param {string} headSha full SHA of the PR head
 */
export function hasHumanSignoff(body, headSha) {
  if (!body || !/^[0-9a-f]{40}$/.test(headSha)) return false
  const re = /^ {0,3}[-*+] +\[[xX]\] +Human read the High-risk diff at ([0-9a-f]{7,40})\b/gm
  for (const m of renderedText(body).matchAll(re)) if (headSha.startsWith(m[1])) return true
  return false
}

/**
 * Files changed between `base` and `head`. Renames count as delete + add (`--no-renames`), so moving a file out of a
 * High path still lists the High source path.
 */
export function changedFiles(base, head = 'HEAD', { includeWorking = !process.env.CI } = {}) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })
  const committed = git('diff', '--name-only', '--no-renames', `${base}...${head}`)
  // Locally, uncommitted and untracked files count too — that's what the next commit will carry.
  const working = includeWorking
    ? `${git('diff', '--name-only', '--no-renames', 'HEAD')}\n${git('ls-files', '--others', '--exclude-standard')}`
    : ''
  return [...new Set(`${committed}\n${working}`.split('\n').filter(Boolean))].sort()
}

function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(name)
    return i === -1 ? undefined : argv[i + 1]
  }
  const base = arg('--base') ?? 'main'
  const head = arg('--head') ?? 'HEAD'
  const result = classify(
    changedFiles(base, head, { includeWorking: !process.env.CI && head === 'HEAD' }),
  )

  if (argv.includes('--json')) console.log(JSON.stringify(result, null, 2))
  else {
    console.log(`Risk: ${result.tier}`)
    for (const { file, why } of result.high) console.log(`  high    ${file}  (${why})`)
    for (const file of result.medium) console.log(`  medium  ${file}`)
  }

  if (argv.includes('--check-signoff') && result.tier === 'High') {
    const sha = process.env.HEAD_SHA ?? ''
    if (!hasHumanSignoff(process.env.PR_BODY, sha)) {
      console.error(
        `\nHigh-risk PR: read the diff of the files above, then add to the PR description:\n` +
          `- [x] Human read the High-risk diff at ${sha.slice(0, 7)}\n` +
          `(Agents never write this line. A new push needs a new line with the new SHA.)`,
      )
      process.exit(1)
    }
    console.log(`\nHuman sign-off found for ${sha.slice(0, 7)}.`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
