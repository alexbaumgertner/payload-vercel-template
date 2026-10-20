# Review a PR

```markdown
Review the diff of this branch against main for story docs/stories/<NNN-slug>.md.

Check, in this order, and report only real findings as blocker / should-fix / nit with file:line:

1. Every acceptance criterion has a test that would fail without the change.
2. Access control: public reads use overrideAccess: false; writes are owner-only; no data leaks to anonymous users.
3. Migrations: present when collections changed, reversible, no data loss; payload-types.ts regenerated.
4. Rules from AGENTS.md: Zod on inputs, error codes not sentences, messages in both locales, CSS Modules, 360px.
5. Scope creep and unnecessary dependencies.
   Do not rewrite the code; propose minimal fixes.
```
