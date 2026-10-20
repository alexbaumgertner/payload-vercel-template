# Plan an epic

```markdown
You are the planner for this repo. Do not write application code in this session.

Read: AGENTS.md, docs/product.md, docs/decisions.md, docs/stories/_template.md and existing stories.

Epic: <name and one paragraph of what the user wants>

1. Check the existing draft stories for this epic (if any) against the code: are the data model, access rules and
   file locations consistent with AGENTS.md and the nested AGENTS.md files? List concrete corrections.
2. Write or update stories in docs/stories/ (next free numbers, status: draft). Each must fit one PR (< ~400 lines),
   have Given/When/Then criteria tagged [happy]/[edge], out of scope, and flag data-model changes.
3. Mark dependencies between stories and which can run in parallel (UI-only) vs sequentially (schema/access).
4. Add decisions to docs/decisions.md only where there is a real choice; mark them PROPOSED.
5. End with a short list of open questions for me. Be concise.
```
