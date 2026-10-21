# Baseline

What every product built from this template gets out of the box. Update this table in every PR that changes one of these areas.

| Area               | Status  | Note                                                                                                                                                         |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth               | done    | Passwordless email codes for the admin; hashed codes, DB rate limits, signed cookie                                                                          |
| i18n               | done    | next-intl: `en` (unprefixed) + `/ru`; hreflang, `<html lang>`, switcher; changelog via Payload localization                                                  |
| Accessibility      | done    | axe on every public page (light/dark, desktop/mobile), fails on serious/critical; one `<main>`/`h1`; contrast tokens                                         |
| SEO                | done    | `robots.txt` indexes production only; sitemap per locale with hreflang; canonical; share image per locale (Geist, no network)                                |
| Security headers   | partial | HSTS, nosniff, Referrer/Permissions-Policy, frame-ancestors enforced; CSP report-only, no violations in a prod build                                         |
| Backups            | done    | Daily encrypted DB copy by email (Production, off until configured) + verify/restore scripts and drill; Neon restore window. Not covered: Blob media         |
| Monitoring         | done    | Sentry (server, client, Server Actions) when `SENTRY_DSN` is set; PII scrubbed; no-op otherwise                                                              |
| Analytics          | done    | Typed `track()` catalog, no-op by default; Vercel adapter via `ANALYTICS_PROVIDER`; DNT/GPC respected, no PII                                                |
| CI                 | done    | Actions: format, check, int, browser, e2e; migrations applied to an empty DB + int on that schema; no secrets needed                                         |
| Preview smoke      | done    | Every ready Vercel Preview: health + Lighthouse gate on `/` and `/changelog`; skips without the bypass secret                                                |
| Agent environments | done    | Claude Code hooks/guards, Codex cloud + Claude Code on the web (`cloud-setup.sh`), dev container, Operator worktrees (`local-env.sh`); `docs/new-product.md` |
| Health             | done    | `GET /api/health`: DB round-trip, 200/503, uncached, not localized; used by preview smoke                                                                    |
| Operations         | done    | Cron routes fail closed without `CRON_SECRET`; non-login mail gated on previews and the sandbox sender                                                       |
| Dependency updates | done    | Dependabot weekly: one PR with all minor/patch updates, each major separately; `@types/node` follows Node 24                                                 |

Features are specified in `docs/stories/` — each acceptance criterion maps to a named test.
Agent safety: shell + MCP guards with tests (Claude Code, Cursor), env-file permissions, Codex Stop check; known gaps
(Codex and cloud agents skip the guards) in `docs/decisions.md`.
