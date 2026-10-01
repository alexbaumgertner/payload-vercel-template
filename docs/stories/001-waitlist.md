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
10. `[edge]` **Given** the Russian landing page (`/ru`) **when** I submit an invalid email, hit a server error or succeed **then** every label, validation and status message is in Russian.
11. `[edge]` **Given** a tampered hidden `source` field **when** I submit a valid email **then** the request is refused without marking the email field invalid.

## Out of scope

- Double opt-in / confirmation email, unsubscribe, export.
- Rate limiting signups (the honeypot is the only bot filter).
- Storing the visitor's locale on the signup.

## Verification

The server action returns error codes (`invalid_email`, `invalid_request`, `server`); the form maps them to copy from `messages/<locale>.json`.

| #   | Test (file › name)                                                                                             | Layer   |
| --- | -------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `tests/e2e/landing.e2e.spec.ts` › joins the waitlist with a valid email                                        | e2e     |
| 1   | `tests/int/waitlist.int.spec.ts` › creates a signup for a new email                                            | int     |
| 1   | `tests/int/waitlist-action.int.spec.ts` › stores a valid signup with its source and reports success            | int     |
| 1   | `tests/browser/WaitlistForm.browser.spec.tsx` › submits the source and leaves the honeypot empty               | browser |
| 2   | `tests/unit/waitlist-schema.unit.spec.ts` › normalizes email to trimmed lowercase                              | unit    |
| 3   | `tests/int/waitlist.int.spec.ts` › is idempotent for an existing email                                         | int     |
| 3   | `tests/int/waitlist-action.int.spec.ts` › answers an existing email exactly like a new one                     | int     |
| 3   | `tests/int/waitlist.int.spec.ts` › treats two simultaneous submits of the same email as one signup             | int     |
| 4   | `tests/e2e/landing.e2e.spec.ts` › rejects an invalid email without leaving the page                            | e2e     |
| 4   | `tests/browser/WaitlistForm.browser.spec.tsx` › shows the en message for invalid_email                         | browser |
| 4–5 | `tests/int/waitlist-action.int.spec.ts` › rejects an empty / missing @ / too long email with a field error     | int     |
| 4–5 | `tests/unit/waitlist-schema.unit.spec.ts` › rejects invalid email                                              | unit    |
| 6   | `tests/int/waitlist-action.int.spec.ts` › pretends success for bots that fill the honeypot, but stores nothing | int     |
| 7   | `tests/browser/WaitlistForm.browser.spec.tsx` › disables the form while the action is pending                  | browser |
| 8   | `tests/int/waitlist-action.int.spec.ts` › shows a retry message and logs when the database fails               | int     |
| 8   | `tests/browser/WaitlistForm.browser.spec.tsx` › shows the en message for server                                | browser |
| 9   | `tests/int/waitlist.int.spec.ts` › keeps signups private from anonymous API access                             | int     |
| 9   | `tests/int/waitlist.int.spec.ts` › refuses anonymous creates, updates and deletes through the API              | int     |
| 9   | `tests/int/waitlist.int.spec.ts` › lets a signed-in admin read signups with access control on                  | int     |
| 10  | `tests/e2e/i18n.e2e.spec.ts` › validates the waitlist form in Russian                                          | e2e     |
| 10  | `tests/e2e/i18n.e2e.spec.ts` › confirms a waitlist signup in Russian                                           | e2e     |
| 10  | `tests/browser/WaitlistForm.browser.spec.tsx` › shows the ru message for invalid_email / server                | browser |
| 10  | `tests/browser/WaitlistForm.browser.spec.tsx` › confirms the signup in Russian                                 | browser |
| 11  | `tests/int/waitlist-action.int.spec.ts` › refuses a tampered hidden source field without blaming the email     | int     |
