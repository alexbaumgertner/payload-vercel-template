---
id: 001
title: Join the waitlist from the landing page
status: done
---

# 001 — Join the waitlist

**As a** visitor interested in the product
**I want** to leave my email on the landing page
**so that** I hear about the launch without creating an account.

## Acceptance criteria

1. `[happy]` **Given** the landing page **when** I submit a valid email **then** I see "You're on the list" and a signup is stored with the form's `source`.
2. `[edge]` **Given** an email with spaces or capitals **when** I submit it **then** it is stored trimmed and lowercase.
3. `[edge]` **Given** an email already on the list **when** I submit it again **then** I see the same success message and no duplicate is stored (the form can't be used to probe the list).
4. `[edge]` **Given** an invalid or empty email **when** I submit **then** I stay on the page and see "Enter a valid email address." next to the field.
5. `[edge]` **Given** an email longer than 254 characters **when** I submit **then** it is rejected as invalid.
6. `[edge]` **Given** a bot that fills the hidden "company" field **when** it submits **then** it sees success but nothing is stored.
7. `[edge]` **Given** a pending submission **when** I click again **then** the form is disabled until the first one finishes (no double submit).
8. `[edge]` **Given** the database fails **when** I submit **then** I see "Something went wrong on our side" and the error is logged server-side.
9. `[edge]` **Given** an anonymous REST/GraphQL client **when** it reads or creates `waitlist-signups` **then** it is refused.

## Out of scope

- Double opt-in / confirmation email, unsubscribe, export.
- Rate limiting signups (the honeypot is the only bot filter).

## Verification

| #   | Test (file › name)                                                                                             | Layer   |
| --- | -------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `tests/e2e/landing.e2e.spec.ts` › joins the waitlist with a valid email                                        | e2e     |
| 1   | `tests/int/waitlist.int.spec.ts` › creates a signup for a new email                                            | int     |
| 1   | `tests/browser/WaitlistForm.browser.spec.tsx` › submits the source and leaves the honeypot empty               | browser |
| 2   | `tests/unit/waitlist-schema.unit.spec.ts` › normalizes email to trimmed lowercase                              | unit    |
| 3   | `tests/int/waitlist.int.spec.ts` › is idempotent for an existing email                                         | int     |
| 4   | `tests/e2e/landing.e2e.spec.ts` › rejects an invalid email without leaving the page                            | e2e     |
| 3   | `tests/int/waitlist-action.int.spec.ts` › answers an existing email exactly like a new one                     | int     |
| 3   | `tests/int/waitlist.int.spec.ts` › treats two simultaneous submits of the same email as one signup             | int     |
| 4–5 | `tests/int/waitlist-action.int.spec.ts` › rejects an empty / missing @ / too long email with a field error     | int     |
| 4–5 | `tests/unit/waitlist-schema.unit.spec.ts` › rejects invalid email                                              | unit    |
| 6   | `tests/int/waitlist-action.int.spec.ts` › pretends success for bots that fill the honeypot, but stores nothing | int     |
| 7   | `tests/browser/WaitlistForm.browser.spec.tsx` › disables the form while the action is pending                  | browser |
| 8   | `tests/int/waitlist-action.int.spec.ts` › shows a retry message and logs when the database fails               | int     |
| 9   | `tests/int/waitlist.int.spec.ts` › keeps signups private from anonymous API access                             | int     |
| 9   | `tests/int/waitlist.int.spec.ts` › refuses anonymous creates, updates and deletes through the API              | int     |
| 9   | `tests/int/waitlist.int.spec.ts` › lets a signed-in admin read signups with access control on                  | int     |
