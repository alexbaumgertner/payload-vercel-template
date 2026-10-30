// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { classify, hasHumanSignoff } from '../../scripts/risk-tier.mjs'

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
  ])('rejects %s', (_label, body) => {
    expect(hasHumanSignoff(body, sha)).toBe(false)
  })

  it('rejects when the head SHA is missing or malformed', () => {
    expect(hasHumanSignoff('- [x] Human read the High-risk diff at a1b2c3d', '')).toBe(false)
  })
})
