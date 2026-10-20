import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const fontsDir = join(root, 'src/fonts')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx|mts|js|mjs)$/.test(entry.name) ? [path] : []
  })
}

describe('vendored fonts', () => {
  it('nothing loads fonts from Google at build time', () => {
    const offenders = [...sourceFiles(join(root, 'src')), join(root, 'next.config.ts')]
      .filter((file) => /['"]next\/font\/google['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file))
    expect(offenders).toEqual([])
  })

  it('every font file the site loads exists and has a license and a README row', () => {
    const site = readFileSync(join(fontsDir, 'site.ts'), 'utf8')
    const readme = readFileSync(join(fontsDir, 'README.md'), 'utf8')
    const paths = [...site.matchAll(/path: '\.\/files\/([^']+)'/g)].map((m) => m[1] ?? '')
    expect(paths.length).toBeGreaterThan(0)
    for (const file of paths) {
      expect(existsSync(join(fontsDir, 'files', file)), file).toBe(true)
      expect(readme, file).toContain(`\`${file}\``)
    }
    for (const file of readdirSync(join(fontsDir, 'files'))) {
      expect(readme, `${file} is documented`).toContain(`\`${file}\``)
    }
    for (const license of readme.matchAll(/`licenses\/([^`]+)`/g)) {
      expect(existsSync(join(fontsDir, 'licenses', license[1] ?? '')), license[1]).toBe(true)
    }
  })

  it('keeps the CSS variable names globals.css reads', () => {
    const site = readFileSync(join(fontsDir, 'site.ts'), 'utf8')
    const css = readFileSync(join(root, 'src/app/(frontend)/globals.css'), 'utf8')
    for (const variable of ['--font-geist-sans', '--font-geist-mono']) {
      expect(site).toContain(`variable: '${variable}'`)
      expect(css).toContain(`var(${variable})`)
    }
  })
})
