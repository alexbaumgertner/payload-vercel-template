#!/usr/bin/env node
// Risk tier of a change, set from the files it touches — not from who (or what) wrote it.
//
//   node scripts/risk-tier.mjs                 # this branch vs main, plus uncommitted work
//   node scripts/risk-tier.mjs --base origin/main --json
//   node scripts/risk-tier.mjs --base origin/main --head FETCH_HEAD --check-signoff
//                                              # CI: High needs the owner's sign-off label for the head commit
//
// Low    — docs, tests, copy only. Automated review + CI are enough.
// Medium — ordinary product code. Read the reviewer's findings and the evidence.
// High   — auth, access, schema, migrations, CI, agent guards, security headers, env, deploy config,
//          dependencies. A human reads the diff of these files; see REVIEW.md and AGENTS.md → Code review.
//
// Start strict, loosen with evidence: move a path down a tier only after its misses stay at zero
// in docs/review-misses.md.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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

/** Added by the owner after reading the High-risk diff. Agents never add it. */
export const SIGNOFF_LABEL = 'risk: human-read'

/**
 * A High-risk PR is signed off only by the act of adding SIGNOFF_LABEL — not by the label sitting on the PR, and not
 * by anything in the description (parsing Markdown for a checklist line was bypassed three review rounds in a row).
 * So this run must be the `labeled` event for that label, sent by someone with admin/maintain on the repo, and the PR
 * head must still be the commit the label was added on, with the label still on the PR. Any later event — a push,
 * reopen, another label — re-runs the check, fails it, and the owner removes and re-adds the label after reading the
 * new diff. A re-run ("Re-run jobs") replays the original event and sender, so it would bring back a sign-off the
 * owner revoked: only the first attempt of a run counts.
 * @param {{ action?: string, label?: { name?: string }, sender?: { login?: string }, pull_request?: { head?: { sha?: string } } }} event
 * @param {{ currentHeadSha: string, currentLabels: string[], senderRole: string | undefined, runAttempt: number }} facts
 *   current PR head and labels, the sender's repo role, and GITHUB_RUN_ATTEMPT
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function checkSignoff(event, { currentHeadSha, currentLabels, senderRole, runAttempt }) {
  if (event.action !== 'labeled' || event.label?.name !== SIGNOFF_LABEL)
    return { ok: false, reason: `this run is not the "${SIGNOFF_LABEL}" label being added` }
  if (runAttempt !== 1)
    return { ok: false, reason: 're-runs replay an old label event and never sign off' }
  if (!currentLabels.includes(SIGNOFF_LABEL))
    return { ok: false, reason: 'the label was removed after it was added' }
  if (!['admin', 'maintain'].includes(senderRole ?? ''))
    return { ok: false, reason: `${event.sender?.login ?? 'sender'} has no admin/maintain role` }
  const sha = event.pull_request?.head?.sha
  if (!sha || sha !== currentHeadSha)
    return { ok: false, reason: 'the PR head moved after the label was added' }
  return { ok: true }
}

async function githubFacts(event) {
  const { GITHUB_API_URL = 'https://api.github.com', GITHUB_REPOSITORY, GITHUB_TOKEN } = process.env
  const get = async (path) => {
    const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}${path}`, {
      headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`GET ${path}: ${res.status}`)
    return res.json()
  }
  const pr = await get(`/pulls/${event.pull_request.number}`)
  const login = event.sender?.login
  const perm = login
    ? await get(`/collaborators/${encodeURIComponent(login)}/permission`)
    : undefined
  return {
    currentHeadSha: pr.head.sha,
    currentLabels: pr.labels.map((l) => l.name),
    senderRole: perm?.role_name,
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT ?? 1),
  }
}

/**
 * Files changed between `base` and `head`. Renames count as delete + add (`--no-renames`), so moving a file out of a
 * High path still lists the High source path. Output is NUL-delimited (`-z`): without it git C-quotes non-ASCII names
 * (`"src/features/auth/caf\303\251.ts"`) and the anchored High patterns miss them.
 */
export function changedFiles(base, head = 'HEAD', { includeWorking = !process.env.CI } = {}) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).split('\0')
  const files = git('diff', '-z', '--name-only', '--no-renames', `${base}...${head}`)
  // Locally, uncommitted and untracked files count too — that's what the next commit will carry.
  if (includeWorking)
    files.push(
      ...git('diff', '-z', '--name-only', '--no-renames', 'HEAD'),
      ...git('ls-files', '-z', '--others', '--exclude-standard'),
    )
  return [...new Set(files.filter(Boolean))].sort()
}

async function main(argv) {
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
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? '', 'utf8'))
    const sha = event.pull_request.head.sha.slice(0, 7)
    const verdict = checkSignoff(event, await githubFacts(event))
    if (!verdict.ok) {
      console.error(
        `\nHigh-risk PR, no sign-off for ${sha}: ${verdict.reason}.\n` +
          `Read the diff of the files above, then (re-)add the label "${SIGNOFF_LABEL}" — remove it first if it's already on.\n` +
          `(Agents never add this label. A new push needs it added again.)`,
      )
      process.exit(1)
    }
    console.log(`\nSigned off by ${event.sender.login} at ${sha}.`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2))
