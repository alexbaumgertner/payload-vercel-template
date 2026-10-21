#!/usr/bin/env node
// Rename a product created from the template (docs/new-product.md → Rename checklist).
//
//   node scripts/rename-product.mjs <slug> "<Product Name>"
//
// Rewrites package.json `name`, `siteConfig.name`, `Metadata.siteName` in every messages/*.json,
// the README title and the product name at the start of AGENTS.md. Re-running with new values
// works. Everything else on the checklist (copy, product.md) is yours.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SLUG = /^[a-z0-9][a-z0-9-]{0,213}$/

/** Throws on a slug npm would refuse or a name that can't sit on one line. */
export function validate(slug, name) {
  if (!SLUG.test(slug ?? ''))
    throw new Error(`slug must be lowercase letters, digits and -: ${slug}`)
  // No colon: AGENTS.md's intro is found by the first one, so re-running must find it again.
  if (!name?.trim() || /[\r\n:]/.test(name)) throw new Error('name must be one line, without ":"')
}

/** New contents for each file, keyed by path relative to the repo root. Pure: `read(path)` → text. */
export function renameProduct(read, messageFiles, slug, name) {
  validate(slug, name)
  /** @type {Record<string, string>} */
  const out = {}

  const pkg = JSON.parse(read('package.json'))
  out['package.json'] = JSON.stringify({ ...pkg, name: slug }, null, 2) + '\n'

  const site = read('src/config/site.ts')
  const siteName = /(\bname: )'(?:[^'\\]|\\.)*'/
  if (!siteName.test(site)) throw new Error('src/config/site.ts: `name:` not found')
  const quoted = `'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  out['src/config/site.ts'] = site.replace(siteName, (_, key) => key + quoted)

  for (const file of messageFiles) {
    const messages = JSON.parse(read(file))
    if (!messages.Metadata) throw new Error(`${file}: no Metadata namespace`)
    messages.Metadata.siteName = name
    out[file] = JSON.stringify(messages, null, 2) + '\n'
  }

  const readme = read('README.md')
  out['README.md'] = readme.replace(/^# .*$/m, () => `# ${name}`)

  // First paragraph: "<Product>: what it is …" — only the part before the first colon changes.
  const agents = read('AGENTS.md')
  const intro = /^(# AGENTS\.md\n\n)([^\n:]+):/
  if (!intro.test(agents)) throw new Error('AGENTS.md: expected "# AGENTS.md" then "<Name>: …"')
  out['AGENTS.md'] = agents.replace(intro, (_, heading) => `${heading}${name}:`)

  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [slug, name] = process.argv.slice(2)
  const root = join(fileURLToPath(import.meta.url), '../..')
  const messageFiles = readdirSync(join(root, 'messages'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => `messages/${file}`)
  try {
    const files = renameProduct(
      (path) => readFileSync(join(root, path), 'utf8'),
      messageFiles,
      slug,
      name,
    )
    for (const [path, text] of Object.entries(files)) writeFileSync(join(root, path), text)
    console.log(`rename-product: ${Object.keys(files).join(', ')}`)
  } catch (error) {
    console.error(`rename-product: ${error instanceof Error ? error.message : error}`)
    console.error('usage: node scripts/rename-product.mjs <slug> "<Product Name>"')
    process.exit(1)
  }
}
