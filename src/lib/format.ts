const dateFormatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export function formatDate(value: string | Date) {
  return dateFormatter.format(typeof value === 'string' ? new Date(value) : value)
}
