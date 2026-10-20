// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { mediaPrefix } from '@/lib/blob-prefix'

// Preview and production share one Blob store but not one database: without a prefix a preview
// upload can land on a production path and overwrite the file.
describe('mediaPrefix', () => {
  it('keeps production unprefixed: stored URLs must keep resolving', () => {
    expect(mediaPrefix({ VERCEL_ENV: 'production' })).toBe('')
  })

  it('puts preview uploads under preview/', () => {
    expect(mediaPrefix({ VERCEL_ENV: 'preview' })).toBe('preview/')
  })

  it('isolates `vercel dev` too, which can carry the shared token', () => {
    expect(mediaPrefix({ VERCEL_ENV: 'development' })).toBe('development/')
  })

  it('has no prefix locally (no VERCEL_ENV): files go to ./media', () => {
    expect(mediaPrefix({})).toBe('')
    expect(mediaPrefix({ VERCEL_ENV: ' ' })).toBe('')
  })

  it('gives the same file different paths in preview and production', () => {
    const path = (env: string) => `${mediaPrefix({ VERCEL_ENV: env })}logo.png`
    expect(path('preview')).not.toBe(path('production'))
  })
})
