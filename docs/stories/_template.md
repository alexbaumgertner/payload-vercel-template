---
id: NNN
title: Short outcome, in the user's words
status: draft # draft | approved | in-progress | done
---

# NNN — Title

**As a** <role from docs/product.md>
**I want** <capability>
**so that** <outcome they care about>.

## Acceptance criteria

Each criterion becomes at least one test named after the behavior. Tag every criterion `[happy]` or `[edge]`.
Think about: empty / too-long input, unauthorized, rate-limited, non-default locale, double submit, third-party failure.

1. `[happy]` **Given** <context> **when** <action> **then** <observable result>.
2. `[edge]` **Given** … **when** … **then** ….

## Out of scope

- <what this story deliberately does not do>

## Verification

| #   | Test (file › name)        | Layer                         |
| --- | ------------------------- | ----------------------------- |
| 1   | `tests/…` › `<test name>` | unit / browser / int / e2e    |
| 2   | manual: <what to check>   | browser (Chrome DevTools MCP) |
