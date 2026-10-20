# Runbook: add an admin to production

For the human operator. Agents must not run this (the shell guard blocks `ALLOW_REMOTE_DATABASE=1`).

There is no sign-up and no "create first user" screen, so the first admin of a new production deployment — and any
later one — is added from your machine with `pnpm create-admin`. It is the **one deliberate local command against
the production database**. Everything else refuses a remote database:

| Command                                    | Remote database                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `pnpm dev`, `pnpm payload …`, tests        | refused outside Vercel unless `ALLOW_REMOTE_DATABASE=1`; schema push never remote |
| `pnpm create-admin`, `pnpm backup:restore` | refused unless `ALLOW_REMOTE_DATABASE=1`                                          |
| `pnpm seed`                                | refused, no override (runs only locally or on a Vercel Preview build)             |

Rules live in `src/lib/database-target.ts`; the reasons are in `docs/decisions.md`.

## Steps

1. Copy the production **pooled** connection string from the Neon console (or Vercel → Storage). Do not use
   `vercel env pull`: it writes every production secret into the checkout.
2. Run, in one line, with the URL only in this command (never in a `.env*` file):

   ```bash
   DATABASE_URI='<production pooled url>' ALLOW_REMOTE_DATABASE=1 pnpm create-admin you@yourdomain.com
   ```

   `DATABASE_URI` wins over the `DATABASE_URL` in your local env files (`src/lib/database-url.ts`). The first log
   line shows `[db] using DATABASE_URI: <host>/<db> · fingerprint …` — check it is the database you meant.

3. Sign in at `https://<your domain>/admin` with the email code.
4. Clear the URL from your shell history if your shell records it (`history -d`, or a leading space with
   `HISTCONTROL=ignorespace`).

`create-admin` only inserts a `users` row; it does not push schema (push never runs against a remote database) and
does not run migrations — the Vercel build does that.
