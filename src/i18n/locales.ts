// Shared by next-intl routing and Payload localization; no framework imports (the Payload CLI loads it).
export const locales = ['en', 'ru'] as const
export const defaultLocale = 'en'
export const localeLabels: Record<(typeof locales)[number], string> = {
  en: 'English',
  ru: 'Русский',
}
