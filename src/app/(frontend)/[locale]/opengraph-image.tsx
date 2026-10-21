import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'

import { siteConfig } from '@/config/site'
import { routing } from '@/i18n/routing'
import { OG_IMAGE_SIZE, OG_IMAGE_TYPE, renderSiteCard } from '@/lib/og-image'
import { siteUrl } from '@/lib/site-url'

// Default share image for every public page; a page can add its own opengraph-image next to it.
export const size = OG_IMAGE_SIZE
export const contentType = OG_IMAGE_TYPE
export const alt = siteConfig.name

// One card per locale, rendered at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  const t = await getTranslations({ locale, namespace: 'Metadata' })
  return renderSiteCard({
    name: siteConfig.name,
    tagline: t('tagline'),
    host: new URL(siteUrl()).host,
  })
}
