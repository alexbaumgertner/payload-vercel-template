// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { changedFiles, classify, hasHumanSignoff } from '../../scripts/risk-tier.mjs'

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

  it('accepts a ticked line naming the head commit (short or full SHA)', () => {
    expect(
      hasHumanSignoff(`text\n- [x] Human read the High-risk diff at ${sha.slice(0, 7)}\n`, sha),
    ).toBe(true)
    expect(hasHumanSignoff(`* [X] Human read the High-risk diff at ${sha}`, sha)).toBe(true)
  })

  it.each([
    ['unticked', `- [ ] Human read the High-risk diff at ${sha.slice(0, 7)}`],
    ['older commit', '- [x] Human read the High-risk diff at 9999999'],
    ['no SHA', '- [x] Human read the High-risk diff at'],
    ['quoted, not a list item', `> Human read the High-risk diff at ${sha.slice(0, 7)}`],
    ['empty body', ''],
    ['indented code block', `    - [x] Human read the High-risk diff at ${sha.slice(0, 7)}`],
    // Pasting the gate's own failure output into the Evidence block must not sign anything off.
    [
      'inside a fenced code block',
      `## Evidence\n\n\`\`\`\nHigh-risk PR: …\n- [x] Human read the High-risk diff at ${sha.slice(0, 7)}\n\`\`\``,
    ],
    [
      'inside a ~~~ fence',
      `~~~text\n- [x] Human read the High-risk diff at ${sha.slice(0, 7)}\n~~~`,
    ],
    [
      'inside an HTML comment (the template example)',
      `<!--\n- [x] Human read the High-risk diff at ${sha.slice(0, 7)}\n-->`,
    ],
    [
      'inside an unclosed HTML comment',
      `<!-- - [x] Human read the High-risk diff at ${sha.slice(0, 7)}`,
    ],
  ])('rejects %s', (_label, body) => {
    expect(hasHumanSignoff(body, sha)).toBe(false)
  })

  it('accepts a real line after a closed code block and comment', () => {
    const body = `\`\`\`\nlog\n\`\`\`\n<!-- note -->\n- [x] Human read the High-risk diff at ${sha.slice(0, 7)}`
    expect(hasHumanSignoff(body, sha)).toBe(true)
  })

  it('rejects when the head SHA is missing or malformed', () => {
    expect(hasHumanSignoff('- [x] Human read the High-risk diff at a1b2c3d', '')).toBe(false)
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
