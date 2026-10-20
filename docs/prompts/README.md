# Prompts

Reusable prompts for the multi-agent workflow (see `AGENTS.md` → "Multi-agent workflow" and
`docs/decisions.md` → 2026-10-20). Copy, fill the `<…>` parts, paste.

| File                 | Where                                                                    | Model                  |
| -------------------- | ------------------------------------------------------------------------ | ---------------------- |
| `plan-epic.md`       | Claude Code, plan mode                                                   | Opus                   |
| `implement-story.md` | Codex cloud task (or Claude Code `/feature`)                             | Codex default / Sonnet |
| `implement-story.md` | Operator (home-server orchestrator): one task → worktree on `agent/<id>` | Opus / Sonnet          |
| `review-pr.md`       | Claude Code with `reviewer`, or Codex                                    | Sonnet / Codex         |
| `research-spike.md`  | Deep-research tool (Gemini Deep Research, ChatGPT/Claude research)       | —                      |

Operator runs are unattended: nobody answers mid-run, so the prompt must say "conservative option + questions in
the PR" (as `implement-story.md` does) and the task branch is kept as-is.
