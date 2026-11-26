# DARFIX maintenance & CX cadence

Operating rhythm for the Growth OS demo → production path.

## Weekly

- Bug triage (P0/P1 from staging + partner Slack)
- Seat-limit / trial edge cases
- Agent tool smoke (`darfix_health` across peers)

## Biweekly

- UX review: company dashboard, Control Tower alerts, technician job flow
- Onboarding survey completion quality (missing CR / cities / SLA)

## Monthly

- KPI review: lead response time, accept rate, job completion, quote approval latency
- Seat utilization by plan (upgrade funnel)
- Campaign calendar for next Saudi season (Growth Marketer drafts → human approve)

## Always-on

- Staging environment before partner-facing changes
- Error monitoring on API (add Sentry/OpenTelemetry in production)
- Agent evals in `darfix-agents/*/evals`
- SQLite backups via `scripts/backup-db.sh` (demo); Postgres PITR in production

## Backup / restore (demo SQLite)

```bash
cd darfix
./scripts/backup-db.sh
# Restore: stop API, copy backup over data/darfix.sqlite (+ wal/shm if present), restart
```

Admin API: `POST /api/admin/backup` (admin token).
