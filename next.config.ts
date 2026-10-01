import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'
import { fileURLToPath } from 'url'

import { securityHeaders } from './src/lib/security-headers'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const sentryDsn = process.env.SENTRY_DSN?.trim() ?? ''

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The DSN is public by design; one server-side variable drives both runtimes.
  env: {
    NEXT_PUBLIC_SENTRY_DSN: sentryDsn,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT:
      process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV || '',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders({ isDev: process.env.NODE_ENV !== 'production' }),
      },
    ]
  },
  // Bottom-left (the default) covers the Payload admin nav's "Log out" button.
  devIndicators: { position: 'bottom-right' },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const config = withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })

// Without a DSN the build is untouched: no Sentry plugin, no tunnel route, no source-map upload.
export default sentryDsn
  ? withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Same-origin endpoint: survives ad blockers and keeps CSP `connect-src 'self'`.
      tunnelRoute: '/monitoring',
      widenClientFileUpload: true,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
      telemetry: false,
      // Errors only, no tracing, so router transitions are not instrumented.
      suppressOnRouterTransitionStartWarning: true,
      silent: !process.env.CI,
    })
  : config
