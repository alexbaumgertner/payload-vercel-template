# Decisions

Short log of choices that shape the codebase. Newest first. One entry = what we chose, why, and what would make us revisit it.

## Local dev uses Payload push; production uses migrations

Push keeps iteration fast (no migration per field tweak). Migrations are generated once per merged change and applied in the Vercel build (`pnpm build:vercel`), not on cold start, so requests never wait on DDL.
Revisit if: several people work on the schema at the same time.

## Payload inside the Next.js app instead of a separate CMS/API

One deploy, one repo, Local API calls without network hops, admin panel for free. Waitlist and changelog are Payload collections.
Revisit if: the admin needs to scale independently or a non-JS client needs heavy API traffic.

## Postgres on Neon via `@payloadcms/db-postgres`

Relational data, branching per preview deploy, scales to zero. The standard `pg` pool works with Neon's pooled connection string.
Revisit if: we need edge-runtime DB access (then look at the Neon serverless driver).

## CSS Modules + CSS variables, no utility framework

Zero runtime, no build plugin, easy for agents to follow one convention. Tokens live in `src/app/(frontend)/globals.css`.

## Server Actions + Zod for mutations

No hand-written REST layer for our own UI. Zod schemas live in `features/*/schema.ts` and are shared by client and server.
Payload's REST/GraphQL stays available for admin and future integrations, but private collections are closed to it.

## Pinned toolchain versions

- TypeScript 6.0: typescript-eslint (used by eslint-config-next) supports `<6.1`; TS 7 (native) is not supported yet.
- ESLint 9: eslint-plugin-react / import / jsx-a11y bundled by eslint-config-next do not support ESLint 10 yet.
- graphql 16: Payload 3 peer range is `^16.8.1`.
- Next.js ≥16.3.3: minimum supported by Payload 3.90 on the 16.x line.
  Revisit on each Payload minor release (`pnpm outdated`).
