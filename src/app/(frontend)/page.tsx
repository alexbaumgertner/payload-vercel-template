import Link from 'next/link'

import { ChangelogList } from '@/components/ChangelogList/ChangelogList'
import { WaitlistForm } from '@/components/WaitlistForm/WaitlistForm'
import { siteConfig } from '@/config/site'
import { getChangelogEntries } from '@/features/changelog/queries'

import styles from './page.module.css'

export const revalidate = 3600

const features = [
  {
    title: 'Content & admin in one app',
    body: 'Payload 3 runs inside Next.js: collections, auth, uploads and a full admin panel at /admin — no second service to deploy.',
  },
  {
    title: 'Postgres that scales to zero',
    body: 'Neon in production, plain Postgres locally. Schema changes go through versioned Payload migrations, applied on every Vercel deploy.',
  },
  {
    title: 'Type-safe end to end',
    body: 'Generated Payload types, Zod at every boundary, Server Actions instead of hand-written API routes.',
  },
  {
    title: 'Tests the agent can run',
    body: 'Vitest for logic and the Payload Local API, Playwright for real user flows. One command tells the agent whether it is done.',
  },
  {
    title: 'AI workflow built in',
    body: 'AGENTS.md, scoped Cursor rules, skills, subagents and hooks — shared by Cursor and Claude Code from the same files.',
  },
  {
    title: 'Plain CSS Modules',
    body: 'Design tokens as CSS variables, dark mode via prefers-color-scheme, zero runtime styling cost.',
  },
]

export default async function HomePage() {
  const latest = await getChangelogEntries({ limit: 3 })

  return (
    <>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Next.js 16 · Payload 3 · Neon · Vercel</p>
        <h1 className={styles.title}>{siteConfig.tagline}</h1>
        <p className={styles.lead}>{siteConfig.description}</p>
        <WaitlistForm source="landing-hero" />
        <p className={styles.note}>Early access updates only. No spam, unsubscribe anytime.</p>
      </section>

      <section id="features" className={styles.section} aria-labelledby="features-title">
        <h2 id="features-title" className={styles.sectionTitle}>
          Everything a solo founder needs on day one
        </h2>
        <ul className={styles.grid}>
          {features.map((feature) => (
            <li key={feature.title} className={styles.card}>
              <h3 className={styles.cardTitle}>{feature.title}</h3>
              <p className={styles.cardBody}>{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="latest-title">
        <div className={styles.sectionHeader}>
          <h2 id="latest-title" className={styles.sectionTitle}>
            Latest releases
          </h2>
          <Link href="/changelog" className={styles.more}>
            Full changelog →
          </Link>
        </div>
        <ChangelogList entries={latest} />
      </section>
    </>
  )
}
