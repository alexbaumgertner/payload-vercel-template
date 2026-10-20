import { describe, expect, test } from 'vitest'

import { categoryScore, checkReport } from '../../scripts/lighthouse-check.mjs'

/** Minimal Lighthouse report: three SEO audits (one is `is-crawlable`) plus three flat categories. */
function report({
  crawlable = 0,
  title = 1,
  performance = 0.95,
}: { crawlable?: number; title?: number; performance?: number } = {}) {
  return {
    categories: {
      performance: { score: performance },
      accessibility: { score: 1 },
      'best-practices': { score: 1 },
      seo: {
        // What Lighthouse reports itself — dragged down by is-crawlable on a preview.
        score: 0.6,
        auditRefs: [
          { id: 'is-crawlable', weight: 4.043 },
          { id: 'document-title', weight: 1 },
          { id: 'meta-description', weight: 1 },
          { id: 'structured-data', weight: 0 },
        ],
      },
    },
    audits: {
      'is-crawlable': { score: crawlable },
      'document-title': { score: title },
      'meta-description': { score: 1 },
      'structured-data': { score: null },
      'hreflang-not-applicable': { score: null },
    },
  }
}

describe('preview Lighthouse gate', () => {
  test('ignores is-crawlable (previews are noindex) but nothing else in SEO', () => {
    expect(categoryScore(report(), 'seo')).toBe(1)
    expect(checkReport(report()).ok).toBe(true)
  })

  test('still fails SEO when another SEO audit fails', () => {
    // document-title failing: (0 + 1) / 2 = 0.5 < 0.9
    expect(categoryScore(report({ title: 0 }), 'seo')).toBe(0.5)
    expect(checkReport(report({ title: 0 })).ok).toBe(false)
  })

  test('fails when a category is below its threshold', () => {
    const { ok, lines } = checkReport(report({ performance: 0.79 }))
    expect(ok).toBe(false)
    expect(lines).toContain('FAIL performance: 79, min 80')
  })

  test('fails when a category is missing from the report', () => {
    const broken = report()
    delete (broken.categories as Partial<typeof broken.categories>).accessibility
    expect(checkReport(broken).ok).toBe(false)
  })
})
