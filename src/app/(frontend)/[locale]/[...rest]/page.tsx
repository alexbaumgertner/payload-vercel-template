import { notFound } from 'next/navigation'

// Unknown public paths render the localized not-found page inside the locale layout.
export default function CatchAll() {
  notFound()
}
