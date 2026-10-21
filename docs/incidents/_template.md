# Incident: <what users saw, in plain words> (<start date> → <end date>)

<!-- File as docs/incidents/YYYY-MM-<slug>.md. Blameless: describe systems and signals, not people.
Write it while the facts are fresh; link fix commits/PRs. Facts first, interpretation after. -->

| Field      | Value                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| Status     | <Investigating / Mitigated / Resolved YYYY-MM-DD HH:MM UTC (how verified)> |
| Duration   | <first bad event UTC> → <recovery UTC> (<n days/hours>)                    |
| Impact     | <who/what was affected; data lost, delayed or exposed>                     |
| Detected   | <date, and by whom/what — monitoring, a user, by chance>                   |
| Root cause | <one line>                                                                 |

## Summary

<Three to six sentences: what failed, what the error was (quote it), why everything still looked healthy.>

```
<the actual error message or log line>
```

## Root cause

- <Commit `<sha>` (date) changed …>.
- <The mechanism, down to the library behaviour that made it fail>.
- <How and when it reached production (deploy, migration, image build)>.

## Why data was lost, not just delayed

<Skip if nothing was lost. Otherwise: the sequence that turned a failure into permanent loss — retries that never
happened, watermarks that advanced, cleanups that ran.>

1. <step>

## Why nobody noticed

<Every signal that should have caught it, and why it didn't: errors stored but not logged, exit code 0, no alert, no
heartbeat, "broken" indistinguishable from "nothing new", no test for the contract.>

1. <reason>

## Fix

- <Code fix (commit/PR) and the test that now fails against the old code>.
- <Detection fix: alert, health check, log, heartbeat>.

## Recovery

<Manual steps taken, in order, with who ran them. Production steps are human-only (`docs/runbooks/`).>

1. <step>

## Outcome

<What was restored, what is permanently missing, and how that was verified.>

## Follow-ups

| #   | Action                                    | Owner         | Status            |
| --- | ----------------------------------------- | ------------- | ----------------- |
| 1   | <prevent the class of bug, not only this> | <human/agent> | <open / done SHA> |
