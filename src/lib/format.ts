const formatters = new Map<string, Intl.DateTimeFormat>()

/** Release dates in UTC, so every visitor sees the same day, in the visitor's language. */
export function formatDate(value: string | Date, locale = 'en') {
  let formatter = formatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    formatters.set(locale, formatter)
  }
  return formatter.format(typeof value === 'string' ? new Date(value) : value)
}
