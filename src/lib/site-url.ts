type Env = Record<string, string | undefined>

/**
 * Absolute origin of the public site, without a trailing slash, for URLs that leave the page:
 * sitemap, robots, `metadataBase` (canonical, hreflang, Open Graph images).
 *
 * `NEXT_PUBLIC_SITE_URL` (set it in Production once the domain is known) → the project's production
 * domain on Vercel → this deployment's own URL → localhost. Reads the raw environment rather than
 * `env.ts`, whose default for `NEXT_PUBLIC_SITE_URL` would hide the Vercel fallbacks.
 */
export function siteUrl(env: Env = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  // Vercel system variables are bare hostnames.
  for (const host of [env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL]) {
    const value = host?.trim().replace(/\/+$/, '')
    if (value) return `https://${value}`
  }
  return 'http://localhost:3000'
}
