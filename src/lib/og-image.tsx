import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const
export const OG_IMAGE_TYPE = 'image/png'

// Satori (next/og) can't read WOFF2, so the card uses static TTF cuts of the site font. next/og
// bundles only a regular weight (and older versions a Latin-only font that fetched missing glyphs
// such as Cyrillic from Google Fonts at render time); these files pin both weights and the glyphs.
const FONT = 'Geist'
const fontsDir = join(process.cwd(), 'src/fonts/files')
let fontFiles: Promise<[Buffer, Buffer]> | undefined

/** Regular + semi-bold Geist for `ImageResponse`'s `fonts` option (read once per process). */
export async function ogFonts() {
  fontFiles ??= Promise.all([
    readFile(join(fontsDir, 'geist-400.ttf')),
    readFile(join(fontsDir, 'geist-600.ttf')),
  ])
  const [regular, semiBold] = await fontFiles
  return [
    { name: FONT, data: regular, weight: 400 as const, style: 'normal' as const },
    { name: FONT, data: semiBold, weight: 600 as const, style: 'normal' as const },
  ]
}

// Colours mirror the light-theme tokens in src/app/(frontend)/globals.css (Satori has no CSS variables).
const colors = { bg: '#fbfaf7', text: '#1b1a17', muted: '#6b675e', accent: '#e8590c' }

type SiteCard = { name: string; tagline: string; host: string }

/** Default share card: site name, tagline (in the page's language) and host. */
export async function renderSiteCard({ name, tagline, host }: SiteCard) {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        background: colors.bg,
        color: colors.text,
        fontFamily: FONT,
        borderTop: `16px solid ${colors.accent}`,
      }}
    >
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 600, color: colors.accent }}>
        {name}
      </div>
      <div style={{ display: 'flex', fontSize: 72, fontWeight: 600, lineHeight: 1.1 }}>
        {tagline}
      </div>
      <div style={{ display: 'flex', fontSize: 28, color: colors.muted }}>{host}</div>
    </div>,
    {
      ...OG_IMAGE_SIZE,
      fonts: await ogFonts(),
    },
  )
}
