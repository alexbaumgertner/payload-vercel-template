---
id: 003
title: Sign in to the admin with an emailed one-time code
status: done
---

# 003 — Passwordless admin login

**As an** admin of the product
**I want** to sign in with a 6-digit code sent to my email
**so that** there is no password to forget, leak or brute-force.

## Acceptance criteria

1. `[happy]` **Given** I am a user **when** I enter my email at `/admin/login` and then the emailed code **then** I land in the admin, signed in via the `indie_session` cookie.
2. `[happy]` **Given** I am signed in **when** I click "Log out" **then** the session cookie is cleared and I'm back on the login page.
3. `[edge]` **Given** an email that is not a user **when** I request a code **then** I see exactly the same screen as a real user, and no email is sent.
4. `[edge]` **Given** a wrong code **when** I submit it **then** I see "The code is wrong or has expired." and stay on the code step.
5. `[edge]` **Given** 5 wrong attempts **when** I then enter the right code **then** it is refused ("Too many attempts").
6. `[edge]` **Given** a code older than 10 minutes, or one that was already used, or not the latest one **when** I submit it **then** it is refused.
7. `[edge]` **Given** 3 code requests for one email in 15 minutes, or 20 from one IP in an hour **when** I request another **then** I see "Too many attempts. Try again later."
8. `[edge]` **Given** the email provider fails **when** I request a code **then** I see "Could not send the email with your code" instead of a false "code sent".
9. `[edge]` **Given** a malformed email or code (empty, letters, too long) **when** I submit **then** I get a validation error and no attempt is spent.
10. `[edge]` **Given** `POST /api/users/login` with a password **when** called **then** it is refused.
11. `[edge]` **Given** a `?redirect=` pointing to another origin **when** I sign in **then** I'm sent to `/admin` instead (no open redirect).
12. `[edge]` **Given** a tampered, expired or foreign-secret session cookie **when** I call the API **then** I'm treated as anonymous.
13. `[edge]` **Given** an anonymous API client **when** it reads `auth-codes` or `users`, or creates a user **then** it is refused.

## Out of scope

- Self sign-up, SSO/OAuth, customer-facing accounts, "remember this device".

## Verification

| #   | Test (file › name)                                                                                                                                          | Layer    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1–2 | `tests/e2e/auth.e2e.spec.ts` › signs in with a code and logs out                                                                                            | e2e      |
| 1   | `tests/int/auth.int.spec.ts` › authenticates requests carrying a valid session cookie                                                                       | int      |
| 3   | `tests/e2e/auth.e2e.spec.ts` › unknown addresses get the same answer as real ones; `otp.unit` › answers the same for unknown addresses but sends nothing    | e2e/unit |
| 4   | `tests/e2e/auth.e2e.spec.ts` › a wrong code is rejected                                                                                                     | e2e      |
| 5   | `tests/unit/otp.unit.spec.ts` › burns the code after 5 wrong attempts, even if the 6th is right                                                             | unit     |
| 6   | `tests/unit/otp.unit.spec.ts` › rejects expired codes · only accepts the latest code · signs a user in once with the right code                             | unit     |
| 7   | `tests/unit/otp.unit.spec.ts` › limits codes per email · limits requests per IP across addresses                                                            | unit     |
| 8   | `tests/unit/otp.unit.spec.ts` › reports a mail failure instead of pretending the code was sent                                                              | unit     |
| 9   | `tests/unit/otp.unit.spec.ts` › rejects malformed emails · rejects an empty/whitespace/too-long email · rejects malformed codes without spending an attempt | unit     |
| 10  | `tests/e2e/auth.e2e.spec.ts` › password login is disabled on the API                                                                                        | e2e      |
| 11  | `tests/unit/redirect.unit.spec.ts` › falls back to /admin for … (absolute, protocol-relative, backslash, tab, javascript:)                                  | unit     |
| 13  | `tests/int/auth.int.spec.ts` › hides the user list from anonymous API clients · has no self sign-up                                                         | int      |
| 12  | `tests/unit/session.unit.spec.ts` › rejects a tampered user id or signature · rejects tokens signed with another secret · expires                           | unit     |
| 13  | `tests/int/auth.int.spec.ts` › keeps login codes closed to the public API                                                                                   | int      |
