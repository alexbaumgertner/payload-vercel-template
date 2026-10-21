# Security reviews

Point-in-time security reviews of this product, one file per review, named `YYYY-MM-DD-<short-sha>.md` after the
commit that was reviewed. Empty until the first review; the tables below are the ledger.

## How this works

- **One file per review.** Pin the exact commit in the file header so findings can be checked against that revision.
  Don't edit an old review's findings — supersede them in a newer review.
- **The ledger below is the source of truth for current exposure.** Update a finding's status here when it is fixed
  or accepted; don't rewrite the original report.
- **Reference findings from fix commits**, e.g. `Fixes docs/security/2026-11-02-abc1234.md#f1`, so history links the
  fix back to the report. A fix comes with a test that fails against the vulnerable code.
- **Unfixed vulnerabilities:** if this repo is public, track open high/medium findings in a private GitHub Security
  Advisory or private issue instead of spelling out exploit details in a committed file. Move the full write-up here
  once fixed.
- **Accepted risks** stay in "Open findings" with status `accepted`, a reason and a revisit condition (and an entry in
  `docs/decisions.md` if it shapes the code).
- Reviews start from `AGENTS.md` → Code Review Rules (P0/P1) and the never-weaken list in Auth; `/security-review` or
  `docs/prompts/review-pr.md` can draft one, a human signs it off.

## Reviews

| Date | Commit | Scope | Findings | Report |
| ---- | ------ | ----- | -------- | ------ |

## Open findings

| #   | Finding | Severity | First reported | Status | Notes |
| --- | ------- | -------- | -------------- | ------ | ----- |

## Resolved findings

| #   | Finding | Severity | First reported | Resolved | Notes |
| --- | ------- | -------- | -------------- | -------- | ----- |
