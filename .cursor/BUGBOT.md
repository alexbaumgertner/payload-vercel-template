# Bugbot review rules

Project: Next.js 16 App Router + Payload 3 on Postgres (Neon), deployed to Vercel. See `AGENTS.md`.

Flag as **blocking**:

- A Payload collection without explicit `access` for create/read/update/delete, or public `read: () => true` on data that is not meant to be public.
- Local API calls in `queries.ts` or anything rendering for visitors without `overrideAccess: false`.
- Server Actions that write data without validating input through a Zod schema from `schema.ts`.
- Client components (`'use client'`) importing from `src/lib/payload.ts`, `service.ts`, `queries.ts` or `@payload-config`.
- Changes to `src/collections/**` or `src/payload.config.ts` without a new file in `src/migrations/` and updated `src/payload-types.ts`.
- Migrations that drop columns/tables holding data where a rename was intended.
- New env vars not added to `src/lib/env.ts` and `.env.example`.
- Secrets, tokens or connection strings committed anywhere.

Flag as **should fix**:

- `revalidatePath`/`revalidateTag` in hooks without the `req.context.disableRevalidate` guard.
- UI without empty/error states, or layouts that break below 400px.
- Styling outside CSS Modules (Tailwind classes, inline style objects for static values, CSS-in-JS).
- New runtime dependencies (ask whether it is really needed).
- Behavior changes without tests.
