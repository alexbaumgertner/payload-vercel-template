// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ImageResponse } from 'next/og'
import { createElement } from 'react'

import { OG_IMAGE_SIZE, ogFonts, renderSiteCard } from '@/lib/og-image'

import ru from '../../messages/ru.json'

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('default share image', () => {
  it('renders a Cyrillic tagline from the bundled fonts, without any network request', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const response = await renderSiteCard({
      name: 'Indie Starter',
      tagline: ru.Metadata.tagline,
      host: 'example.com',
    })
    const bytes = Buffer.from(await response.arrayBuffer())

    expect(response.headers.get('content-type')).toBe('image/png')
    expect(pngSize(bytes)).toEqual(OG_IMAGE_SIZE)
    // The renderer loads its wasm through fetch('data:…'); anything over http(s) is a download.
    const requests = fetch.mock.calls.map(([input]) =>
      String(input instanceof Request ? input.url : input),
    )
    expect(requests.filter((url) => /^https?:/.test(url))).toEqual([])
  }, 30_000)

  it('draws semi-bold Cyrillic from the bundled font, not a synthesized regular', async () => {
    const fonts = await ogFonts()
    const render = async (fontWeight: 400 | 600) => {
      const card = createElement(
        'div',
        { style: { display: 'flex', fontFamily: 'Geist', fontSize: 64, fontWeight } },
        'Запустите',
      )
      const response = new ImageResponse(card, { width: 400, height: 100, fonts })
      return Buffer.from(await response.arrayBuffer())
    }
    expect((await render(600)).equals(await render(400))).toBe(false)
  }, 30_000)
})
