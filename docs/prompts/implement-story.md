# Implement a story

Codex cloud: the environment for this repo, branch name from AGENTS.md. Operator: paste as the task; keep the branch
it created. Claude Code: run `/feature` and point it at the story instead.

```markdown
Implement docs/stories/<NNN-slug>.md (status must be `approved`; if it is not, stop and say so).

Follow AGENTS.md and the nested AGENTS.md for every folder you touch. Payload API reference:
.claude/skills/payload/SKILL.md (+ reference/*.md as needed).

Order: failing tests per acceptance criterion → collection → `pnpm generate:types` → service → action → UI.
If the story changes collections, run `pnpm migrate:create <slug>` and commit the migration.
If Postgres is not running, run `bash scripts/cloud-setup.sh`. Other checkouts on this machine: see
"Parallel checkouts" in AGENTS.md.

Nobody will answer questions while you work: when something is ambiguous, take the conservative option, keep going,
and list it under "Open questions" in the PR.

Done when `pnpm format:check`, `pnpm check`, `pnpm test:int` and `pnpm test:e2e` pass, the story's Verification
table is filled and its status is `done`. Open a PR on branch `<agent>/<NNN-slug>` (or the branch you were given)
using .github/pull_request_template.md. Do not change anything outside the story's scope; list follow-ups in the PR.
```
