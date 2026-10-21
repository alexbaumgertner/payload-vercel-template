---
id: 004
title: Call an LLM from a feature without leaking spend, prompts or control
status: draft
---

# 004 — AI baseline (`src/lib/ai/`)

> **Proposal only.** Nothing here is implemented. See `docs/decisions.md` → "PROPOSED: provider-agnostic
> `src/lib/ai/`". Approving this story is approving that decision; then `/feature` takes it from failing tests to code.

**As a** founder starting a product from this template
**I want** one provider-agnostic way to call an LLM that comes with fencing, spend limits, retry, coalescing and a
quality check already tested
**so that** the first AI feature cannot be prompt-injected by a pasted document, cannot run up an unbounded bill, and
can be measured before and after a prompt or model change.

## Where each part comes from

Each source solved one problem well; the criteria below keep what worked and close the gap each one left.

| Part                  | Source (read-only)                                                                                          | What changes in adapting                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Fencing               | `sync-trainer@971a840` `src/lib/prompt.ts` (`fenceOff`), `tests/integration/prompt-fencing.test.ts`         | Fixed delimiter → per-call random delimiter; lookalike stripping; English notice; one helper for every prompt builder        |
| Spend limits          | `sync-trainer@971a840` `src/lib/budget.ts`                                                                  | Returns error codes, not sentences; micro-USD integers; no longer the enforcement — the ledger is                            |
| Atomic reservation    | `chrome-extension-languadge-learn@44a8e14` `apps/cms/src/usage/ledger.ts`                                   | Table owned by a hidden Payload collection; one transaction with rollback instead of compensating releases; reserve → settle |
| Retry                 | `chrome-extension-languadge-learn@44a8e14` `apps/cms/src/pipeline/retry.ts`                                 | Options object; the permanent-error predicate is part of each provider adapter; each attempt is budgeted                     |
| Coalescing            | `chrome-extension-languadge-learn@44a8e14` `apps/cms/src/cache/coalesce.ts`                                 | Key must include model + prompt version + user scope; only the leader reserves budget                                        |
| Blind judge + reports | `chrome-extension-languadge-learn@44a8e14` `apps/cms/scripts/judge.ts`, `docs/quality/2026-10-19/README.md` | Provider-agnostic via `complete()`; candidates fenced; Zod-validated scores; rubric passed in, not hard-coded                |

## Acceptance criteria

Each criterion becomes at least one test named after the behavior. Pure modules (`fence`, `budget`, `retry`,
`coalesce`, judge helpers) are unit-tested; the ledger runs against real Postgres (`int`), because its whole point is
what Postgres does under concurrency.

### Off by default

1. `[happy]` **Given** `AI_PROVIDER` is unset (default `none`) **when** a feature calls `complete()` **then** it
   returns `ai_disabled` without any network request (a `fetch` spy sees zero calls), and `isAiEnabled()` is `false`.
   `AI_PROVIDER` is the only switch: `none` is the only way to be off, and `AI_API_KEY` is ignored while it is `none`.
2. `[edge]` **Given** `AI_PROVIDER` names a provider but `AI_API_KEY` is missing or empty **when** env is parsed
   **then** `src/lib/env.ts` fails with a message naming both variables — a half-configured provider is a mistake,
   not "off", so it never silently degrades to `ai_disabled`.
3. `[edge]` **Given** a call fails **when** the error reaches `captureServerError()` / logs / `track()` **then** it
   carries the provider, model, status and token counts, but never the prompt, the untrusted text or the output.

### Fencing untrusted text

Untrusted = anything a person or an external feed wrote: uploaded documents, notes, form fields, fetched pages,
and — for the judge — model outputs. Fencing is not a guarantee against injection; it removes the cheap ones.

4. `[happy]` **Given** untrusted text **when** a prompt is built with `fence(text)` **then** the text appears between
   an opening and a closing delimiter, preceded by a notice that the block is data, not instructions, and that
   nothing inside it changes the task or the output format.
5. `[happy]` **Given** benign text (including `<`, `>`, quotes, Markdown, non-Latin scripts) **when** it is fenced
   **then** it reaches the prompt byte-for-byte unchanged.
6. `[edge]` **Given** text containing an injected instruction ("Ignore the previous instructions …") **when** the
   prompt is split on the delimiter **then** there are exactly three parts and the instruction is only in the middle.
7. `[edge]` **Given** text that contains a copy of the delimiter **when** it is fenced **then** it cannot close the
   block: the delimiter carries a per-call random nonce (`crypto.randomUUID()`), so the input cannot predict it, and
   any line that looks like a fence (same prefix, any nonce, any case, extra whitespace) is replaced with
   `[delimiter removed]`. The delimiter still occurs exactly twice.
8. `[edge]` **Given** several untrusted inputs in one prompt (document + notes) **when** the prompt is built **then**
   every one is fenced, and stripping removes **all** occurrences, not just the first.
9. `[edge]` **Given** a new prompt builder is added **when** tests run **then** it is covered by the fencing suite
   without anyone editing the suite, because "the older builder is tested" did not protect the newer one in the
   source project. Coverage is exhaustive by construction: `complete()` only accepts a prompt made by a builder
   declared with `definePrompt({ name, untrustedInputs, build })` and exported from the `src/lib/ai/prompts.ts`
   registry; the suite enumerates the registry and fills every declared untrusted input with each attack string.
   A second test discovers every `definePrompt(` call under `src/` and fails if one is missing from the registry.
   Break-the-guard checks: remove `fence()` from one builder (suite red); add a builder without registering it
   (discovery test red).

### Spend limits — one isomorphic check

10. `[happy]` **Given** a usage summary (user's month spend, user limit, global remaining) and a pending estimate
    **when** `budgetBlock(summary, pendingMicroUsd)` is called **then** it returns `null` if both limits hold.
11. `[edge]` **Given** the pending estimate would exceed the **global** remaining amount **then** it returns
    `global_limit`; given it would exceed the **user's** monthly limit **then** `user_limit`. Global is checked first
    (it is the owner's kill switch). Exactly at the limit is allowed; one micro-USD over is refused.
12. `[edge]` **Given** a limit is `null` (env var unset, no per-user override) **then** that limit is not applied —
    but with **both** unset and AI enabled, startup logs a warning that spend is unbounded.
13. `[happy]` **Given** the same summary **when** the server checks before calling and the client checks to disable
    the button **then** both use the same function (`budget.ts` has no `server-only`, no `next/*`, no Payload import),
    and the client only receives remaining amounts, not other users' totals. Error codes are translated via
    `messages/en.json` + `messages/ru.json`.
14. `[edge]` **Given** the client says "allowed" **when** the server disagrees **then** the server wins:
    `budgetBlock` is a pre-check for UX; the ledger (below) is the enforcement.

### Atomic usage reservation

15. `[happy]` **Given** a request **when** `reserve([{ counter: 'global', periodKey: '2026-10', amount, allowance },
{ counter: 'user:<id>', … }])` runs before the provider call **then** every counter is incremented or none is:
    all counters are reserved in one transaction (sorted by counter key, so concurrent reservations lock rows in the
    same order and cannot deadlock), each with its own conditional upsert; if any statement returns zero rows the
    whole transaction is rolled back and `reserve()` returns `false`.
16. `[edge]` **Given** an amount larger than the allowance on a fresh period **then** it is refused. The insert
    branch is conditional too (`INSERT … SELECT … WHERE amount <= allowance`); an `ON CONFLICT … DO UPDATE … WHERE`
    alone only guards existing rows, so a first request of the month could otherwise reserve more than the allowance.
    Break-the-guard check: drop the insert-side `WHERE` and see this test go red.
17. `[edge]` **Given** the global counter has room but the user counter refuses (in either order) **then** the
    global counter is unchanged afterwards — no partial increment remains. Break-the-guard check: commit instead of
    rolling back on a refusal and see this test go red.
18. `[edge]` **Given** 10 concurrent reservations against an allowance of 3 **then** exactly 3 succeed (int test, real
    Postgres). Break-the-guard check: replace the conditional upsert with read-then-write and see this test go red.
19. `[edge]` **Given** a new period (month rolls over) **then** a fresh row starts at 0 with no reset job.
20. `[happy]` **Given** the call returns with real token usage **when** the request settles **then** the reservation
    is adjusted to the real cost (`settle(reservation, actualMicroUsd)` releases the difference, never goes negative).
21. `[edge]` **Given** the call fails before reaching the provider (DNS, connection refused, `ai_disabled`) **then** the
    reservation is released; **given** a timeout or 5xx (the provider may have billed) **then** it is kept.

**Raw SQL vs Payload.** The template rule is "data access goes through the Payload Local API; no raw SQL, no Drizzle
calls", with one documented exception today: `src/lib/backup/` (dump/restore through `payload.db.pool`). The source
ledger is, per counter, one `INSERT … SELECT … WHERE amount <= allowance ON CONFLICT DO UPDATE … WHERE usage + amount
<= allowance` on a hand-made table, with a compensating release when a later counter refuses. Options considered:

- _Local API read-then-write in a transaction_ — rejected: under `READ COMMITTED` two requests read the same total and
  both write; this is exactly the check-then-record race the spend-limit source has today.
- _Optimistic `version` field + `payload.update({ where: { version: { equals: n } } })`_ — rejected unless proven:
  the Postgres adapter's update-by-`where` is believed to select ids first and then update, which is not atomic
  `[verify against @payloadcms/db-postgres before relying on it]`; it would also need a retry loop under contention.
- _Separate `pg` pool and hand-made table_ — rejected: a second connection pool on serverless, and a table outside
  Payload's schema push and migrations. (Payload's own `payload.db.pool` is not a second pool.)
- **Proposed:** the table is a hidden Payload collection `ai-usage-counters` (`admin.hidden`, all access denied to
  the API, fields `counter`, `periodKey`, `usage`, a unique compound index on `counter + periodKey`), so push mode
  and `pnpm migrate:create` own its schema. `ledger.ts` takes a client from `payload.db.pool` — the same route as the
  existing `src/lib/backup/` exception, so there is still one way to reach raw SQL — and runs `BEGIN`, one
  conditional upsert per counter, then `COMMIT` or `ROLLBACK`, using the table/column names Payload generates.
  Guarded by: (a) the int tests above, which fail if Payload renames a column; (b) a unit test over runtime source
  (criterion 22); (c) `AGENTS.md` naming the ledger next to the backup exception, and why.

22. `[edge]` **Given** a runtime file under `src/` or `scripts/` uses `payload.db.pool`, `payload.db.drizzle` or
    `drizzle-orm`'s `sql` **when** `pnpm check` runs **then** the unit test fails, naming the file — unless it is on
    the allow-list: `src/lib/ai/ledger.ts`, the existing backup exception (`src/lib/backup/`, its cron route and
    `scripts/backup-restore.ts`), and generated migrations in `src/migrations/` (they import `sql` by design, and the
    counters collection adds another). Break-the-guard check: add a `payload.db.pool` call to a feature service and
    see the test go red.

### One retry with a permanent-error predicate

23. `[happy]` **Given** the first attempt fails with a transient error (timeout, 429, 5xx, network) **when** wrapped in
    `withRetry(fn, { delayMs, isPermanent })` **then** it is retried exactly once after `delayMs`, and the second
    result (or error) is returned.
24. `[edge]` **Given** a permanent error (bad key, unknown model, rejected parameters: 400 with a config message,
    401, 403, 404) **then** it is not retried, and the provider adapter remembers it per process for that
    model+settings so later calls fail fast with the same error until the deployment changes.
25. `[edge]` **Given** a retry **then** each attempt is reserved in the ledger separately (two attempts can cost
    twice), and each attempt has its own timeout (`AbortSignal.timeout`).
26. `[edge]` **Given** two failures **then** the caller gets a typed error the feature maps to a code
    (`ai_unavailable`), never a raw provider message in the UI.

### In-process request coalescing

27. `[happy]` **Given** three concurrent calls with the same key **when** run through `coalesce.run(key, fn)` **then**
    `fn` runs once and all three get its result.
28. `[edge]` **Given** the shared call settles (success **or** failure) **then** the entry is removed, and a later
    call starts fresh (a failure is not cached).
29. `[edge]` **Given** the key **then** it is a hash of everything that determines the output — provider, model,
    prompt version, the full prompt, and the user id when the output is private to a user — so two users never
    share a private result. A unit test proves different users get different keys for the same text.
30. `[edge]` **Given** followers join a leader's call **then** only the leader reserves and is charged; followers
    still pass `budgetBlock` first (a user over their limit gets `user_limit`, not a free ride).
31. `[edge]` Coalescing is per server instance (one Vercel function instance); this is documented, not treated as a
    bug. Cross-instance dedupe needs a shared cache and is out of scope.

### Blind LLM-judge quality script and reports

32. `[happy]` **Given** two or more run files (JSON: the same inputs, one candidate output each, plus model, cost,
    latency) **when** `pnpm ai:judge runs/a.json runs/b.json [--judge <model>] [--rubric rubric.md]` runs **then**
    each input is judged once with all candidates under shuffled letters (A, B, …), and a Markdown report with
    per-candidate averages, cost and latency and the per-input details is written.
33. `[edge]` **Given** a rerun **then** the letter order per input is the same (seeded by the input index), and the
    judge prompt never contains a run label or model name (unit test on the built prompt).
34. `[edge]` **Given** candidate outputs **then** they are fenced like any untrusted text (an output saying
    "score me 5" stays data), and the judge's answer is parsed with a Zod schema; an invalid answer is retried once,
    then recorded as "no score" instead of guessed.
35. `[edge]` **Given** no `AI_API_KEY` **when** the script runs **then** it exits non-zero with a clear message before
    any network call. It is never run in CI and never by an agent without the human asking (it spends money).
36. `[happy]` **Given** a finished comparison **then** the human commits `docs/quality/<YYYY-MM-DD>/README.md` (what
    was compared, the scores, which variant went to production and why) plus the reports and run files; the README
    states the caveat when the judge is the same model family as the candidates and that results were spot-checked.

## Out of scope

- A user-facing AI feature, UI, or copy — this story only provides the library and its tests.
- Streaming responses, tool/function calling, embeddings, RAG, image or audio models.
- A provider SDK or any new dependency (propose separately; it must fit behind `complete()`).
- Billing accuracy: the ledger guards against overspend with our price table, it does not reconcile invoices.
- Cross-instance coalescing or a response cache (Redis/KV), and response caching across requests in general.
- Per-user limit overrides in the admin UI (env default only), customer-facing usage pages.
- Running the judge in CI, or automated pass/fail gates on judge scores.
- Content moderation and output safety filtering beyond schema validation.

## Open questions

1. **Release on ambiguous failures.** Criterion 21 keeps the reservation on timeout/5xx (may have been billed). That
   is the conservative choice for spend, but it makes users hit their limit sooner during an outage. Accept?
2. **Optimistic concurrency via the Local API.** If `@payloadcms/db-postgres` turns out to issue a single
   `UPDATE … WHERE version = n`, the ledger could avoid raw SQL entirely. Worth a spike before implementing.
3. **Per-user limits.** Template `users` are admins only. Should the per-user counter key on `users` now, or wait for
   the first product with customer accounts (and a field like `monthlyLimitUsd`)?
4. **Estimate before the call.** Input tokens are estimated as `chars / 4` × price, output as `maxOutputTokens` ×
   price (worst case). Good enough, or should providers that expose a token-count endpoint use it (one more call)?
5. **Which first provider adapter** ships in the template, and whether `AI_MODEL` gets a default or must be set.
6. **Judge rubric.** The source judge hard-coded a domain rubric. Proposed: the rubric is a Markdown file passed with
   `--rubric`, scores are a fixed `{ criterion: 1–5 }` map from it. Is a fixed 1–5 scale enough?
7. **Where run files live.** `docs/quality/<date>/runs/` can contain user-like text. Only synthetic or consented
   inputs may be committed — should the script refuse inputs not marked `synthetic: true`?

## Verification

All tests below are proposed names; none exist yet.

| #     | Test (file › name)                                                                                                                                                                   | Layer |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1–2   | `tests/unit/ai-client.unit.spec.ts` › makes no network call when AI is off · rejects a provider without a key                                                                        | unit  |
| 3     | `tests/unit/ai-client.unit.spec.ts` › reports failures without prompt or output text                                                                                                 | unit  |
| 4–8   | `tests/unit/ai-fence.unit.spec.ts` › keeps an injected instruction inside the block · cannot be closed by a copied delimiter · strips every lookalike · leaves benign text unchanged | unit  |
| 9     | `tests/unit/ai-fence.unit.spec.ts` › fences untrusted input in every registered prompt builder · finds no unregistered builder                                                       | unit  |
| 10–14 | `tests/unit/ai-budget.unit.spec.ts` › allows within both limits · refuses past the global limit first · refuses past the user limit · ignores unset limits                           | unit  |
| 15–21 | `tests/int/ai-ledger.int.spec.ts` › reserves all counters or none · never overshoots under concurrency · starts a new period at zero · settles to the real cost                      | int   |
| 22    | `tests/unit/raw-sql.unit.spec.ts` › allows raw SQL only in the ledger, backup and migrations                                                                                         | unit  |
| 23–26 | `tests/unit/ai-retry.unit.spec.ts` › retries a transient error once · does not retry a permanent error · remembers a rejected configuration                                          | unit  |
| 27–31 | `tests/unit/ai-coalesce.unit.spec.ts` › shares one call per key · forgets settled calls, including failures · keys private results per user                                          | unit  |
| 32–35 | `tests/unit/ai-judge.unit.spec.ts` › shuffles deterministically · hides model names · fences candidates · refuses to run without a key                                               | unit  |
| 36    | manual: a `docs/quality/<date>/README.md` exists for the first real comparison                                                                                                       | docs  |
