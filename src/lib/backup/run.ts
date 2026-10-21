import type { SendEmailOptions } from 'payload'

import type { SendMailResult } from '../mail-gate'
import { backupFileName, backupKey, packDump } from './crypto'
import { createDump, type Queryable, summarize, totalRows } from './dump'

/**
 * Resend accepts up to 40 MB per email after base64 encoding (+33%). 25 MB of encrypted file
 * stays well below it.
 */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

export type BackupDeps = {
  /** A client from Payload's pool. Only called when the backup is configured. */
  connect: () => Promise<Queryable & { release: () => void }>
  /** Mail to the operator (`sendMail(payload, 'operator', …)`). */
  send: (message: SendEmailOptions) => Promise<SendMailResult>
  siteName: string
  now?: () => Date
}

export type BackupOutcome =
  | { status: 'skipped'; reason: 'not_configured' }
  | { status: 'sent'; rows: number; bytes: number }
  | { status: 'failed'; error: string }

/**
 * Daily backup: dump → gzip → AES-256-GCM → mail to `BACKUP_EMAIL`. The mailbox is the only store.
 *
 * Off (no database access, no mail) unless both `BACKUP_EMAIL` and `CRON_SECRET` are set — the same
 * "unset = no-op" rule as every optional integration. Once configured, every problem — missing or
 * malformed `BACKUP_KEY`, a dump error, a copy over the size cap, mail refused — sends a
 * "backup NOT made" email without an attachment: a silent failure is worse than none, and an
 * unencrypted copy is never mailed.
 */
export async function runBackup(
  deps: BackupDeps,
  env: Record<string, string | undefined>,
): Promise<BackupOutcome> {
  const to = env.BACKUP_EMAIL?.trim()
  if (!to || !env.CRON_SECRET?.trim()) return { status: 'skipped', reason: 'not_configured' }

  const now = deps.now ?? (() => new Date())
  const date = now().toISOString().slice(0, 10)
  try {
    const key = backupKey(env)
    if (!key) throw new Error('BACKUP_KEY is not set; refusing to mail an unencrypted copy')

    const client = await deps.connect()
    let dump
    try {
      dump = await createDump(client, env.DATABASE_URL ?? '', now())
    } finally {
      client.release()
    }

    const file = packDump(dump, key)
    if (file.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new Error(
        `The encrypted copy is ${megabytes(file.byteLength)} MB, over the ${megabytes(MAX_ATTACHMENT_BYTES)} MB ` +
          'mail limit. Email no longer fits this database: move backups to object storage.',
      )
    }

    const result = await deps.send({
      to,
      subject: `${deps.siteName} backup ${date}`,
      text: [
        `Database backup ${dump.createdAt} (source fingerprint ${dump.source}).`,
        '',
        summarize(dump),
        '',
        `Encrypted file: ${Math.ceil(file.byteLength / 1024)} KB. Media files in Vercel Blob are not included.`,
        'Check it: BACKUP_KEY=… pnpm backup:verify <file>',
      ].join('\n'),
      attachments: [
        // Base64, because the Resend adapter sends JSON and would serialise a Buffer as an object.
        {
          filename: backupFileName(deps.siteName, dump.createdAt),
          content: file.toString('base64'),
        },
      ],
    })
    if (!result.sent) throw new Error(`the backup email was not sent (${result.reason})`)

    return { status: 'sent', rows: totalRows(dump), bytes: file.byteLength }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[backup] failed:', message)
    await deps
      .send({
        to,
        subject: `${deps.siteName} backup NOT made ${date}`,
        text: `The daily database backup failed:\n\n${message}\n\nSee docs/runbooks/backup-restore.md.`,
      })
      .catch((mailError: unknown) =>
        console.error('[backup] failure email not sent:', String(mailError)),
      )
    return { status: 'failed', error: message }
  }
}

const megabytes = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10
