// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { changedFiles, checkSignoff, classify, SIGNOFF_LABEL } from '../../scripts/risk-tier.mjs'

describe('risk tier', () => {
  it.each([
    [['docs/decisions.md', 'README.md'], 'Low'],
    [['tests/unit/seo.unit.spec.ts', 'messages/en.json', 'messages/ru.json'], 'Low'],
    [['src/payload-types.ts'], 'Low'],
    [[], 'Low'],
    [['src/components/Hero/Hero.tsx', 'docs/stories/004-x.md'], 'Medium'],
    [['src/features/waitlist/actions.ts'], 'Medium'],
    [['src/features/auth/otp.ts'], 'High'],
    [['src/access/isAdmin.ts'], 'High'],
    [['src/collections/Users.ts'], 'High'],
    [['src/migrations/20261030_x.ts'], 'High'],
    [['src/payload.config.ts'], 'High'],
    [['src/lib/security-headers.ts'], 'High'],
    [['src/lib/backup/dump.ts'], 'High'],
    [['src/proxy.ts'], 'High'],
    [['src/instrumentation-client.ts'], 'High'],
    [['.github/workflows/ci.yml'], 'High'],
    [['scripts/agent-hooks/policy.mjs'], 'High'],
    [['scripts/risk-tier.mjs'], 'High'],
    [['.claude/settings.json'], 'High'],
    [['.codex/hooks.json'], 'High'],
    [['pnpm-lock.yaml'], 'High'],
    [['vercel.json'], 'High'],
    [['.env.example'], 'High'],
  ])('%j → %s', (files, tier) => {
    expect(classify(files).tier).toBe(tier)
  })

  it('reports why each file is High and lists Medium files', () => {
    const r = classify(['src/features/auth/session.ts', 'src/components/Nav/Nav.tsx', 'docs/x.md'])
    expect(r.high).toEqual([{ file: 'src/features/auth/session.ts', why: 'auth' }])
    expect(r.medium).toEqual(['src/components/Nav/Nav.tsx'])
  })

  it('a Markdown file inside a High path stays High', () => {
    expect(classify(['src/collections/AGENTS.md']).tier).toBe('High')
  })
})

describe('human sign-off', () => {
  const sha = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
  const labeled = {
    action: 'labeled',
    label: { name: SIGNOFF_LABEL },
    sender: { login: 'owner' },
    pull_request: { head: { sha } },
  }
  const facts = {
    currentHeadSha: sha,
    currentLabels: [SIGNOFF_LABEL],
    senderRole: 'admin',
    runAttempt: 1,
  }

  it('accepts the owner adding the label on the current head', () => {
    expect(checkSignoff(labeled, facts).ok).toBe(true)
    expect(checkSignoff(labeled, { ...facts, senderRole: 'maintain' }).ok).toBe(true)
  })

  it.each([
    [
      'a push (label still on the PR)',
      { ...labeled, action: 'synchronize', label: undefined },
      facts,
    ],
    ['a reopen', { ...labeled, action: 'reopened', label: undefined }, facts],
    ['another label being added', { ...labeled, label: { name: 'bug' } }, facts],
    ['the label being removed', { ...labeled, action: 'unlabeled' }, facts],
    ['a sender with write only', labeled, { ...facts, senderRole: 'write' }],
    ['a sender with no role', labeled, { ...facts, senderRole: undefined }],
    ['a head that moved after labeling', labeled, { ...facts, currentHeadSha: 'f'.repeat(40) }],
    ['an event without a head SHA', { ...labeled, pull_request: {} }, facts],
    // "Re-run jobs" replays the original labeled event after the owner revoked it.
    ['a re-run of an earlier labeled run', labeled, { ...facts, runAttempt: 2 }],
    ['a label removed since it was added', labeled, { ...facts, currentLabels: ['bug'] }],
  ])('rejects %s', (_label, event, f) => {
    expect(checkSignoff(event, f).ok).toBe(false)
  })
})

describe('changed files', () => {
  function repo() {
    const dir = mkdtempSync(path.join(tmpdir(), 'risk-tier-'))
    const git = (...args: string[]) =>
      execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
        encoding: 'utf8',
      })
    git('init', '-q', '-b', 'main')
    mkdirSync(path.join(dir, 'src/features/auth'), { recursive: true })
    writeFileSync(path.join(dir, 'src/features/auth/otp.ts'), 'export const x = 1\n'.repeat(20))
    git('add', '-A')
    git('commit', '-qm', 'base')
    return { dir, git }
  }

  it('a rename out of a High path keeps the High source path', () => {
    const { dir, git } = repo()
    git('checkout', '-qb', 'feature')
    mkdirSync(path.join(dir, 'src/lib'), { recursive: true })
    git('mv', 'src/features/auth/otp.ts', 'src/lib/otp.ts')
    git('commit', '-qm', 'move')
    const cwd = process.cwd()
    process.chdir(dir)
    try {
      const files = changedFiles('main', 'HEAD', { includeWorking: false })
      expect(files).toEqual(['src/features/auth/otp.ts', 'src/lib/otp.ts'])
      expect(classify(files).tier).toBe('High')
    } finally {
      process.chdir(cwd)
    }
  })

  it('non-ASCII file names are matched as written, not C-quoted', () => {
    const { dir, git } = repo()
    git('checkout', '-qb', 'feature')
    writeFileSync(path.join(dir, 'src/features/auth/café.ts'), 'export const y = 1\n')
    git('add', '-A')
    git('commit', '-qm', 'unicode')
    writeFileSync(path.join(dir, 'src/features/auth/naïve.ts'), 'export const z = 1\n')
    const cwd = process.cwd()
    process.chdir(dir)
    try {
      const committed = changedFiles('main', 'HEAD', { includeWorking: false })
      expect(committed).toEqual(['src/features/auth/café.ts'])
      expect(classify(committed).tier).toBe('High')
      expect(changedFiles('main', 'HEAD', { includeWorking: true })).toEqual([
        'src/features/auth/café.ts',
        'src/features/auth/naïve.ts',
      ])
    } finally {
      process.chdir(cwd)
    }
  })
})
