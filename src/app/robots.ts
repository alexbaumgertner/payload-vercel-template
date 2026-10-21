import type { MetadataRoute } from 'next'

import { buildRobots } from '@/lib/seo'
import { siteUrl } from '@/lib/site-url'

// Decided per request from VERCEL_ENV, so a build can never carry one environment's answer into another.
export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  return buildRobots(siteUrl(), process.env)
}
