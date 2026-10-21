# Spike NNN — <question in one line>

Date: YYYY-MM-DD. Asked by: <who, and the feedback or story that raised it>.
Time box: <e.g. half a day>. Condition: <what makes the answer "no" outright, e.g. "if it needs a new vendor or a Payload
rewrite, we don't do it">.

<!-- A spike answers one question with a recommendation; it ships no product code. File it as
docs/spikes/NNN-<slug>.md. If the answer is "do it", the follow-up is a story in docs/stories/ and, if it shapes the
architecture, an entry in docs/decisions.md. -->

## Answer

**<Yes / no / yes, but …> — in one sentence.** Recommend option <X>: <what it is>, <its cost>, <its main limit>.
Main cost is <where the real work is — often not where the question pointed>. Estimate: <days, PRs>.

## Constraints

- Load profile: <users, requests, data size — what actually has to scale>.
- Stack rules that apply: <Local API only, no new dependencies without approval, Vercel limits, CSP origins …>.
- <Who writes what / what must not break>.

## What stands in the way today

- <`path/to/file.ts`: concrete obstacle, with the reason it matters>.

## Options

| Option        | <key metric, e.g. latency> | Cost / new parts      | Verdict        |
| ------------- | -------------------------- | --------------------- | -------------- |
| **A. <name>** | <value>                    | <none / one route …>  | **Recommend**  |
| B. <name>     | <value>                    | <vendor, keys, CSP …> | Later, if <…>  |
| C. <name>     | <value>                    | <…>                   | No: <one line> |

### B. <name>

<Why not now, and what would change that. One subsection per option worth explaining; facts with sources.>

## Recommended design

1. <Step, with file paths and the rules it follows (Zod, `monitorAction`, `overrideAccess: false` …)>.
2. <Tests that prove it, including one that fails against the broken version>.

## Risks

- <Risk> → <mitigation>.

## Decisions for the owner

- [ ] <Choice only the human can make, with the default the agent will take if unanswered>.

## Sources (checked YYYY-MM-DD)

- <Doc, changelog or experiment — with version numbers>.

## Revisit if

<The condition that would change the recommendation: GA of a beta feature, load ×10, a new requirement.>
