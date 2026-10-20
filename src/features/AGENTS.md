# Feature folders: Server Actions, services, Zod

Feature folder shape:

- `schema.ts` — Zod schema + inferred types + the action state union. No server imports (it is used by client components).
- `service.ts` — `import 'server-only'`; pure business logic taking `payload: Payload` as first argument so it is testable in `tests/int`.
- `actions.ts` — `'use server'`; parse `FormData` with `schema.safeParse`, call the service, return a discriminated union
  (`{ status: 'success' | 'error', ... }`). Never throw to the client; log server errors with a `[feature]` prefix.
  Errors are codes (`error: 'invalid_email'`), never sentences — the component translates them for the visitor's locale.
- `queries.ts` — `import 'server-only'`; reads for Server Components with `overrideAccess: false` and `depth` set explicitly.

Outbound mail: anything except login codes (invites, notifications) goes through `sendMail(payload, 'general', …)` in
`src/lib/mail-gate.ts` — it refuses previews and the `@resend.dev` sandbox sender; never call `payload.sendEmail` directly.

Validation: use `z.flattenError` for field errors, `z.prettifyError` for logs. Normalize input (trim, lowercase) in the schema, not in the action.

Exception: `auth/otp.ts`, `session.ts`, `strategy.ts`, `store.ts` stay framework-free (see the Auth section in the root `AGENTS.md`).
