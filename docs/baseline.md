# Baseline

What every product built from this template gets out of the box. Update this table in every PR that changes one of these areas.

| Area               | Status  | Note                                                                                                                     |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| Auth               | done    | Passwordless email codes for the admin; hashed codes, DB rate limits, signed cookie                                      |
| i18n               | done    | next-intl: `en` (unprefixed) + `/ru`; hreflang, `<html lang>`, switcher; changelog via Payload localization              |
| Accessibility      | done    | axe on every public page (light/dark, desktop/mobile), fails on serious/critical; one `<main>`/`h1`; contrast tokens     |
| Security headers   | partial | HSTS, nosniff, Referrer/Permissions-Policy, frame-ancestors enforced; CSP report-only, no violations in a prod build     |
| Backups            | partial | Daily encrypted DB copy by email (off until configured) + verify/restore scripts; Neon restore; Blob media not backed up |
| Monitoring         | done    | Sentry (server, client, Server Actions) when `SENTRY_DSN` is set; PII scrubbed; no-op otherwise                          |
| Analytics          | done    | Typed `track()` catalog, no-op by default; Vercel adapter via `ANALYTICS_PROVIDER`; DNT/GPC respected, no PII            |
| CI                 | done    | GitHub Actions: format, check, int (Postgres 18), browser, e2e; migrations on an empty DB + int; no secrets              |
| Dev environments   | done    | Dev container (Postgres 18, Claude, Codex); `cloud-pg-start.sh` for cloud agents; `local-env.sh` per checkout            |
| Operations         | done    | `GET /api/health` (DB round-trip, 200/503); cron auth fails closed; non-login mail gated on previews and sandbox         |
| Dependency updates | done    | Dependabot weekly; Payload / React / Next / dev-tools grouped; majors as separate PRs                                    |

Features are specified in `docs/stories/` — each acceptance criterion maps to a named test.
Agent safety: shell + MCP guards with tests (Claude Code, Cursor), env-file permissions, Codex Stop check; known gaps
(Codex and cloud agents skip the guards) in `docs/decisions.md`.
