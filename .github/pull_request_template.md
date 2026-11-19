## Story

docs/stories/<NNN-slug>.md — status set to `done` (or the task this PR implements)

## What changed

-

## Criteria → tests

| #   | Test |
| --- | ---- |
|     |      |

## Evidence

<Commands that ran and what they returned — paste the tail, don't just say "passes". For UI: Preview URL or screenshot at 360px and desktop.>

```
pnpm check      →
pnpm test:int   →
pnpm test:e2e   →
```

## Review

- Reviewer rounds: <n> (cap 3 — see REVIEW.md) · last result: <"0 findings" or the open Important ones and why they stay>
- Pre-existing issues found (separate task, not this PR): <list or "none">

## Risk

`node scripts/risk-tier.mjs` → **<Low / Medium / High>** — <the High files and why, or "—">

What could go wrong in production, and how we'd notice: <one or two lines>

## How to revert

<"Revert the merge commit" is enough only when there is no migration, env var or data change. Otherwise: the down
migration / flag to turn off / env var to restore, in order.>

## For the human

- [ ] Migration to review: <file or "none">
- [ ] New env vars to add in Vercel: <names or "none">
- [ ] Checked on the Vercel Preview at 360px and desktop

<!-- High-risk only: the owner signs off by adding the label "risk: human-read" after reading the diff of the High
files — agents never add it. A new push voids it: remove and re-add the label. -->

## Open questions

<Anything ambiguous: what you chose (the conservative option) and what you need decided. "None" if none.>

## Checks

- [ ] `pnpm format:check`
- [ ] `pnpm check`
- [ ] `pnpm test:int`
- [ ] `pnpm test:e2e`
