# Runbook: backup & restore (Neon Postgres + Vercel Blob)

For the human operator. Agents must not run any step here against production (see `AGENTS.md` → Database).
Anything that depends on your plan or account is marked **[verify in dashboard]** — check it once per product and
write the real value next to the marker.

Sources: Neon docs (Backup & restore, Instant restore, History window) and Vercel Blob docs, read 2026-10-01.

## 1. What holds data

| Store           | What lives there                                                                                                                                                                                   | Backed up by                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Neon Postgres   | `users` + `users_sessions`, `waitlist_signups` (emails — PII), `changelog` + `changelog_locales`, `media` metadata, `auth_codes` (short-lived), Payload preferences/locks/kv, `payload_migrations` | Neon history window (instant restore) + optional snapshots |
| Vercel Blob     | Uploaded media files (only when `BLOB_READ_WRITE_TOKEN` is set)                                                                                                                                    | **Nothing.** No native backup; deletes are permanent       |
| Vercel env vars | `PAYLOAD_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, `SENTRY_*`, …                                                                                                                                  | Not backed up — keep a copy in your password manager       |
| Git             | Code, migrations, seed data                                                                                                                                                                        | GitHub                                                     |

The database and Blob are **not restored together**: Neon restores rows, not files. A `media` row restored from the
past can point at a file that was deleted from Blob since, and a newer file in Blob can be orphaned.

## 2. Neon Postgres

### What is backed up and for how long

- Neon keeps a continuous change history (WAL) for the project's **history window**. Within it you can restore a
  **root** branch (normally `production`/`main`) to any moment, or branch from a past moment.
- Window per plan, per Neon's docs: Free 6 h (max 1 GB of history), Launch default 1 day / max 7 days, Scale default
  1 day / max 30 days. **Your current setting: \_\_\_\_ [verify in dashboard]** (Neon Console → Settings → Postgres →
  History window). If Neon was added through the Vercel Marketplace, the plan may be managed from Vercel
  **[verify in dashboard]**.
- History storage is billed per GB-month **[verify in dashboard]**. Neon's production guidance suggests 7 days.
- **Snapshots** (Console → Backup & restore): manual snapshots on root branches, and scheduled daily/weekly/monthly
  snapshots on paid plans. Limits and retention depend on the plan **[verify in dashboard]**. Use a manual snapshot
  before risky data changes; scheduled snapshots outlive the history window.
- Deleted **projects** have a separate recovery period, unrelated to the history window **[verify in dashboard]**.
- Preview deployments use Neon child branches; those are disposable and have no instant restore of their own.

### How restore behaves (read before you click)

- Restore **overwrites** the whole branch, all databases on it, schema included. It is not a merge: every change after
  the restore point is gone from that branch.
- Neon automatically keeps the pre-restore state as a backup branch `<branch>_old_<timestamp>`. To undo a restore,
  restore again with that branch as the source.
- Connections drop for a moment; the connection string stays the same, so Vercel needs no env change.
- Instant restore does not work on a branch that was itself created from a snapshot restore (Neon limitation).

### Restore production (incident)

1. **Stop writes.** If a deploy causes the bad change, roll it back (Vercel → Deployments → Instant Rollback; which
   deployments you can roll back to depends on the plan **[verify in dashboard]**). Note the time you noticed and the last known-good time, in UTC.
2. **Find the restore point without touching production.** Neon Console → Backup & restore → pick a time →
   **Preview data** (read-only tables, SQL and schema diff at that moment). Narrow the time until the bad change is
   absent. Prefer a time a few seconds _before_ the first bad write.
3. **Decide: full restore or copy-back.**
   - Whole database is wrong (bad migration, mass delete) → full restore (step 4).
   - A few rows are wrong and good writes happened since → don't overwrite. Create a branch from the restore point
     (Branches → New branch → from a past time), export the affected rows from it (`pg_dump --data-only -t <table>` or
     `COPY`), and re-insert them into production by hand. Delete the branch afterwards (it contains PII).
4. **Full restore.** Backup & restore → selected time → **Restore** → confirm. Neon creates `production_old_<ts>`.
5. **Reconcile the schema.** The restored database has the migrations that existed at that moment (see
   `select name from payload_migrations order by id`). Redeploy the current commit in Vercel: `pnpm build:vercel` runs
   `payload migrate` and re-applies any newer migrations. If the restore point is older than a migration that dropped
   or moved data, check that migration's `up` before redeploying.
6. **Check the app.** `/`, `/ru`, `/changelog` render; sign in to `/admin`; latest waitlist signups are what you
   expect; open a media item (see §3 for missing files).
7. **Record it** in `docs/decisions.md` or your incident log: time noticed, restore point, data lost between the
   restore point and the restore, follow-ups. Delete `production_old_<ts>` only once you are sure (it holds PII).

## 3. Vercel Blob (media)

- Vercel Blob runs on S3 (Vercel quotes 11 nines of durability and 99.99% availability). Durability is not a backup:
  `del()` / `vercel blob del` / deleting the store are **permanent and cannot be undone**, and overwrites replace the
  file. Retention of deleted blobs: **none** per Vercel docs **[verify in dashboard]**.
- The template ships **no Blob backup**. Media uploaded through Payload are the only Blob writes. Options, cheapest
  first:
  1. Accept it while media are only marketing images you still have locally. Keep originals in a shared folder.
  2. Periodic copy: a Vercel Cron job that `list()`s the store and streams each blob to an S3/R2 bucket (example in
     Vercel's Blob docs, "Backups"). Cron frequency limits depend on the plan **[verify in dashboard]**.
  3. Continuous copy from an upload hook. Not built — add it when users upload content you can't recreate.
- **Restore** = upload the files back with the same pathname (`vercel blob put` or the SDK), then check that the
  `media` rows' `url`/`filename` resolve. Without a copy, re-upload the originals through the admin.
- CDN caches can serve a deleted or overwritten file for up to ~60 s after the change.

## 4. Restore drill (do this before you need it)

Goal: prove you can get data back and measure how long it takes. The drill never overwrites production.

1. Write down the start time.
2. Neon Console → Branches → **New branch** from `production` at a past time (e.g. 1 hour ago), name it
   `drill-YYYY-MM-DD`.
3. Connect from your machine — not from an agent — with the drill branch's connection string:
   ```bash
   psql "<drill-branch-url>" -c "select count(*) from users" \
     -c "select count(*) from waitlist_signups" \
     -c "select count(*) from changelog" \
     -c "select name from payload_migrations order by id desc limit 1"
   ```
   Compare with production's numbers in the Neon Console (Tables view). Counts should match the past time you chose.
4. Optional, full app check: run the app locally against the drill branch
   (`DATABASE_URL=<drill-branch-url> pnpm dev`) and open `/changelog` and `/admin`. Do not run `pnpm seed` or
   `pnpm migrate` against it.
5. Media: pick three `media` rows (`select filename, url from media limit 3`) and open each URL. If you set up a Blob
   copy, restore one file from it into a test pathname and open it.
6. Delete the drill branch (it contains real emails).
7. Write down the end time and anything that surprised you in the checklist log below.

## 5. Quarterly checklist

Copy into your task tracker every quarter.

- [ ] Neon history window is what you expect: \_\_\_\_ days **[verify in dashboard]**; it covers how long a bad change
      could go unnoticed (weekends, holidays).
- [ ] Scheduled snapshots are on and the latest one is recent **[verify in dashboard]**, or you decided you don't need them.
- [ ] Run the restore drill (§4); record duration and row counts.
- [ ] Vercel Blob: list the store size and count; if users upload anything you can't recreate, schedule the Blob copy (§3).
- [ ] Env vars: the password-manager copy matches Vercel (Project → Settings → Environment Variables), including
      `PAYLOAD_SECRET`. Losing it logs everyone out and invalidates pending login codes; data stays readable.
- [ ] Old `*_old_*` restore branches and drill branches are deleted (they hold PII and cost storage).
- [ ] Neon and Vercel account access: two-factor on, only people who need production have it.
- [ ] `docs/baseline.md` Backups row still describes reality.

## Drill log

| Date | Who | Restore point | Duration | Counts match | Notes |
| ---- | --- | ------------- | -------- | ------------ | ----- |
|      |     |               |          |              |       |
