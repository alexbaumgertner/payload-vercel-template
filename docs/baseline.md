# Baseline

What every product built from this template gets out of the box. Update this table in every PR that changes one of these areas.

| Area               | Status | Note                                                                                     |
| ------------------ | ------ | ---------------------------------------------------------------------------------------- |
| Auth               | done   | Passwordless email codes for the admin; hashed codes, DB rate limits, signed cookie      |
| i18n               | todo   | English only                                                                             |
| Security headers   | todo   | Next.js defaults only                                                                    |
| Backups            | todo   | Relies on Neon/Vercel defaults; no runbook                                               |
| Monitoring         | todo   | Vercel logs only                                                                         |
| Analytics          | todo   | None                                                                                     |
| CI                 | done   | GitHub Actions: check, int (Postgres 15), browser, e2e; no secrets; artifacts on failure |
| Dependency updates | done   | Dependabot weekly; Payload / React / Next / dev-tools grouped; majors as separate PRs    |
