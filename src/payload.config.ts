import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { AuthCodes } from './collections/AuthCodes'
import { ChangelogEntries } from './collections/ChangelogEntries'
import { Media } from './collections/Media'
import { Users } from './collections/Users'
import { WaitlistSignups } from './collections/WaitlistSignups'
import { siteConfig } from './config/site'
import { defaultLocale, localeLabels, locales } from './i18n/locales'
import { announceDatabase } from './lib/database-url'
import { assertDevDatabaseIsLocal, shouldPushSchema } from './lib/database-target'
import { env } from './lib/env'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Which variable and host this process connects to, in the build and runtime logs.
announceDatabase()
// Outside Vercel only a local database, unless ALLOW_REMOTE_DATABASE=1 (src/lib/database-target.ts).
const databaseTarget = { ...process.env, DATABASE_URL: env.DATABASE_URL }
assertDevDatabaseIsLocal(databaseTarget)

export default buildConfig({
  serverURL: env.NEXT_PUBLIC_SITE_URL,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      beforeLogin: ['/components/admin/EmailCodeLogin/EmailCodeLogin#EmailCodeLogin'],
      logout: { Button: '/components/admin/LogoutButton/LogoutButton#LogoutButton' },
    },
  },
  collections: [Users, Media, ChangelogEntries, WaitlistSignups, AuthCodes],
  // Content locales (the admin UI itself stays English). Missing translations fall back to English.
  localization: {
    locales: locales.map((code) => ({ code, label: localeLabels[code] })),
    defaultLocale,
    fallback: true,
  },
  editor: lexicalEditor(),
  email: env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: env.RESEND_API_KEY,
        defaultFromAddress: env.EMAIL_FROM_ADDRESS,
        defaultFromName: siteConfig.name,
      })
    : undefined,
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: env.DATABASE_URL,
    },
    migrationDir: path.resolve(dirname, 'migrations'),
    // Dev push only into a local database; production changes through migrations.
    push: shouldPushSchema(env.PAYLOAD_DB_PUSH, databaseTarget),
  }),
  sharp,
  plugins: [
    vercelBlobStorage({
      enabled: Boolean(env.BLOB_READ_WRITE_TOKEN),
      collections: { media: true },
      token: env.BLOB_READ_WRITE_TOKEN,
    }),
  ],
})
