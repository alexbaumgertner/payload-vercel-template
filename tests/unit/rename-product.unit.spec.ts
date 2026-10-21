import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { renameProduct } from '../../scripts/rename-product.mjs'

const root = join(__dirname, '../..')
const messageFiles = ['messages/en.json', 'messages/ru.json']
const fromDisk = (path: string) => readFileSync(join(root, path), 'utf8')

function rename(slug: string, name: string, read = fromDisk) {
  return renameProduct(read, messageFiles, slug, name)
}

describe('rename-product', () => {
  const out = rename('acme-notes', "Acme's $& Notes")

  it('renames package, site config, message catalogs, README title and AGENTS intro', () => {
    expect(JSON.parse(out['package.json'] ?? '').name).toBe('acme-notes')
    expect(out['src/config/site.ts']).toContain("name: 'Acme\\'s $& Notes',")
    for (const file of messageFiles) {
      expect(JSON.parse(out[file] ?? '').Metadata.siteName).toBe("Acme's $& Notes")
    }
    expect(out['README.md']?.split('\n')[0]).toBe("# Acme's $& Notes")
    expect(out['AGENTS.md']).toMatch(/^# AGENTS\.md\n\nAcme's \$& Notes: landing page/)
  })

  it('touches nothing else in those files', () => {
    expect(Object.keys(out).sort()).toEqual(
      ['AGENTS.md', 'README.md', 'package.json', 'src/config/site.ts', ...messageFiles].sort(),
    )
    const before = JSON.parse(fromDisk('package.json'))
    expect({ ...JSON.parse(out['package.json'] ?? ''), name: before.name }).toEqual(before)
    expect(out['AGENTS.md']?.split('\n').slice(3)).toEqual(
      fromDisk('AGENTS.md').split('\n').slice(3),
    )
  })

  it('can run again on its own output', () => {
    const again = rename('acme', 'Acme', (path) => out[path] ?? fromDisk(path))
    expect(again['src/config/site.ts']).toContain("name: 'Acme',")
    expect(again['AGENTS.md']).toMatch(/^# AGENTS\.md\n\nAcme: landing page/)
  })

  it.each([
    ['Acme', 'Acme'],
    ['-acme', 'Acme'],
    ['acme', ''],
    ['acme', 'Acme\nInc'],
    ['acme', 'Acme: Inc'],
  ])('refuses slug %j / name %j', (slug, name) => {
    expect(() => rename(slug, name)).toThrow()
  })
})
