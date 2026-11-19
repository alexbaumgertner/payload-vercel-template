---
name: explain
description: Write a short explainer of one slice of this codebase as it is today — how a flow works, which files take part, what can break. Use when the user runs /explain or asks how a part of the code works before changing it.
disable-model-invocation: true
---

# /explain <area or question>

Machines read most diffs now, so understanding comes from asking about the slice you're about to touch, not from
reading every PR. Examples: `/explain how login works end to end`, `/explain changelog revalidation`,
`/explain what happens on a waitlist signup`.

1. Read only what the question needs: start from `CLAUDE.md` → "How a request flows", then follow the real imports.
   Read-only — never edit code in this skill.
2. Answer in this shape, in the user's language, under ~60 lines:
   - **One-paragraph answer** to the question.
   - **The path**: numbered steps, each `path:line` → what happens there. Real symbols only, nothing from memory.
   - **Invariants**: what must stay true (from `AGENTS.md`, `REVIEW.md`, `docs/decisions.md`) and which test guards
     each one. Say plainly when an invariant has no test.
   - **Where it breaks**: two or three realistic ways a change here goes wrong, and the risk tier of these files
     (`node scripts/risk-tier.mjs` logic — `HIGH` list).
   - **Read next**: the two files worth opening first.
3. If the user asks for a visual, make one self-contained HTML page with a diagram of the path and offer it as a file —
   don't commit it to the repo.
4. If you find that `CLAUDE.md` / `AGENTS.md` describes this slice wrongly, say so at the end and propose the one-line
   fix; don't apply it unasked.
