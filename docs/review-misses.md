# Review misses

Every bug that got past review — found on a Preview, in production, by a user, or by a later PR — gets one row here.
It is the eval set for the reviewer: when `REVIEW.md`, `.claude/agents/reviewer.md` or the model changes, re-run the
reviewer on the listed PRs (`git diff <fix-sha>~1` … the commit that introduced the bug) and check it now catches them.

Big outages still get a full write-up in `docs/incidents/`; link it here.

**The rule:** a row is done only when the "Fixed at the source" column names something that would catch the same
_class_ of bug next time — a `REVIEW.md` line, an `AGENTS.md` rule, a lint rule, a test, a guard, or a path moved up
in `scripts/risk-tier.mjs`. "Fixed the bug" is not a source fix.

Also loosen with evidence: a path moves down a risk tier only if it has had no rows here for a while.

| Date | What broke (user-visible) | Introduced in (PR / SHA) | Tier then | Which layer should have caught it | Fixed at the source | Reviewer catches it now? |
| ---- | ------------------------- | ------------------------ | --------- | --------------------------------- | ------------------- | ------------------------ |
|      |                           |                          |           |                                   |                     |                          |
