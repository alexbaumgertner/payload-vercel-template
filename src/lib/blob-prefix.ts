/**
 * Path prefix for media in Vercel Blob, per deployment environment.
 *
 * Preview and production share one Blob store (the token is issued to both), but not one
 * database: every preview gets its own Neon branch. Their id counters and file names drift
 * apart, so a preview upload can land on the same path as a production file and overwrite it —
 * silently, because Blob writes replace and deletes are permanent. Every non-production Vercel
 * environment writes under `<VERCEL_ENV>/` (`preview/`, and `development/` for `vercel dev`).
 *
 * Production keeps no prefix: existing files and the URLs stored in the database must keep
 * resolving. Outside Vercel there is no prefix either — without `BLOB_READ_WRITE_TOKEN` uploads go
 * to the local `media/` folder. Read and delete use the `prefix` stored on each `media` row, so a
 * preview never touches production paths.
 */
export function mediaPrefix(env: Record<string, string | undefined>): string {
  const environment = env.VERCEL_ENV?.trim()
  return !environment || environment === 'production' ? '' : `${environment}/`
}
