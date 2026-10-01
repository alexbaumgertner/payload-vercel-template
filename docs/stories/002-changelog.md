---
id: 002
title: Read what shipped on the public changelog
status: done
---

# 002 — Public changelog

**As a** visitor or customer
**I want** to see recent releases on the landing page and the full list at `/changelog`
**so that** I can tell the product is alive and what changed.

**As the** founder
**I want** to write and schedule entries in the admin
**so that** the page updates without a deploy.

## Acceptance criteria

1. `[happy]` **Given** published entries **when** I open `/changelog` **then** I see them newest first with date, tag and summary.
2. `[edge]` **Given** an entry with `publishedAt` in the future **when** an anonymous visitor loads the page **then** it is hidden until that date.
3. `[happy]` **Given** I am signed in to the admin **when** I read the collection **then** I also see scheduled entries.
4. `[edge]` **Given** no published entries **when** I open `/changelog` **then** I see the "No releases yet" empty state instead of a blank page.
5. `[edge]` **Given** an anonymous API client **when** it tries to create, update or delete an entry **then** it is refused.
6. `[edge]` **Given** a summary longer than 280 characters **when** I save in the admin **then** validation rejects it.
7. `[happy]` **Given** I publish, edit or delete an entry **when** the change is saved **then** `/` and `/changelog` are revalidated (except in scripts/tests that set `disableRevalidate`).

## Out of scope

- RSS/Atom feed, per-entry pages, email digests.

## Verification

| #   | Test (file › name)                                                                                            | Layer |
| --- | ------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | `tests/e2e/landing.e2e.spec.ts` › changelog page renders                                                      | e2e   |
| 1   | `tests/int/changelog.int.spec.ts` › lists published entries newest first on the public page                   | int   |
| 1   | `tests/unit/changelog-list.unit.spec.tsx` › renders entries in the given order with date and tag              | unit  |
| 2   | `tests/int/changelog.int.spec.ts` › hides entries scheduled in the future from anonymous readers              | int   |
| 3   | `tests/int/changelog.int.spec.ts` › shows scheduled entries to a signed-in user with access control on        | int   |
| 4   | `tests/unit/changelog-list.unit.spec.tsx` › shows an empty state with a way forward when nothing is published | unit  |
| 5   | `tests/int/changelog.int.spec.ts` › refuses anonymous creates, updates and deletes through the API            | int   |
| 6   | `tests/int/changelog.int.spec.ts` › rejects a summary longer than 280 characters                              | int   |
| 7   | manual: edit an entry in `/admin`, reload `/changelog`                                                        | e2e   |
