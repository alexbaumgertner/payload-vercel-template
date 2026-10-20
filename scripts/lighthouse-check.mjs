#!/usr/bin/env node
// Score gate for Lighthouse JSON reports (workflow `Preview smoke`).
//
//   node scripts/lighthouse-check.mjs lighthouse/home.report.json lighthouse/changelog.report.json
//
// SEO on a Vercel preview: Vercel sends `X-Robots-Tag: noindex` on every preview deployment, so the
// `is-crawlable` audit always fails there and drags the SEO category below any useful threshold.
// The SEO score is therefore recomputed from its weighted audits *without* `is-crawlable` — every
// other SEO audit still counts. Production indexing is not checked here.

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

export const THRESHOLDS = {
  performance: 0.8,
  accessibility: 0.9,
  'best-practices': 0.9,
  seo: 0.9,
}

/** Audits left out of a category's score, with the reason. */
export const EXCLUDED_AUDITS = {
  seo: { 'is-crawlable': 'previews are noindex by design (Vercel X-Robots-Tag)' },
}

/** Weighted mean of a category's audits, skipping excluded and not-applicable (null score) ones. */
export function categoryScore(report, id) {
  const category = report.categories?.[id]
  if (!category) return null
  const excluded = EXCLUDED_AUDITS[id] ?? {}
  if (Object.keys(excluded).length === 0) return category.score
  let weighted = 0
  let total = 0
  for (const ref of category.auditRefs ?? []) {
    if (ref.id in excluded || !ref.weight) continue
    const score = report.audits?.[ref.id]?.score
    if (score === null || score === undefined) continue
    weighted += ref.weight * score
    total += ref.weight
  }
  return total === 0 ? null : weighted / total
}

/** One line per category; `ok` is false when any category is missing or below its threshold. */
export function checkReport(report, thresholds = THRESHOLDS) {
  const lines = []
  let ok = true
  for (const [id, min] of Object.entries(thresholds)) {
    const score = categoryScore(report, id)
    const pass = score !== null && score >= min
    if (!pass) ok = false
    const shown = score === null ? 'missing' : Math.round(score * 100)
    const note = EXCLUDED_AUDITS[id]
      ? ` (without ${Object.keys(EXCLUDED_AUDITS[id]).join(', ')})`
      : ''
    lines.push(`${pass ? 'ok  ' : 'FAIL'} ${id}: ${shown}${note}, min ${Math.round(min * 100)}`)
  }
  return { ok, lines }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    console.error('usage: node scripts/lighthouse-check.mjs <report.json>...')
    process.exit(2)
  }
  let failed = false
  for (const file of files) {
    const report = JSON.parse(readFileSync(file, 'utf8'))
    const { ok, lines } = checkReport(report)
    console.log(`${basename(file)} — ${report.finalDisplayedUrl ?? report.requestedUrl ?? ''}`)
    for (const line of lines) console.log(`  ${line}`)
    if (!ok) failed = true
  }
  process.exit(failed ? 1 : 0)
}
