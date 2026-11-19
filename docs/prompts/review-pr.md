# Review a PR

Claude Code: `reviewer` subagent (it already follows `REVIEW.md`). Codex: `/review` with this prompt. Locally
without a branch: `/code-review`, plus `/security-review` for High-risk changes.

```markdown
Review this branch against main for <story or task>. Follow REVIEW.md: its order of "broken", the
Important / Nit (max 3) / Pre-existing tags, path:line evidence, one finding per bug class, and its output format
(count line first; "0 findings — ship it." when clean).

Risk tier: run `node scripts/risk-tier.mjs`; deep review only for High.
Round: <1 | n, last reviewed SHA <sha>, findings already posted: <list>> — from round 2 review only the new commits
and don't repeat posted findings. If this is round 4+, don't review; say the approach needs rethinking.
Do not rewrite the code; propose minimal fixes.
```
