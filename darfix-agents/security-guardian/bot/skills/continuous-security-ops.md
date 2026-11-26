# Continuous security operations

## Cadence

- **Hourly (schedule):** playbook → audit(notify=true) → summarize new critical/high → propose remediations for `autoFixable` only.
- **Daily:** full findings review; check agent approval flood; confirm CORS/secret/seed posture.
- **After each deploy / publish attempt:** force audit before declaring pilot safe.

## Surfaces

| Surface | Watch for |
| --- | --- |
| Frontend | Hardcoded passwords, quick-login demos, secrets in Vite env |
| Backend | Authz gaps, seed modes, mock pay, health leaks |
| Transport | CORS wildcards, missing TLS in production |
| Data | Partner PII in public APIs, discount dumps, cross-tenant reads |
| Agents | Hardcoded demo creds in tool clients, approval spam, over-broad tools |

## Approval policy

Always propose + wait for human on:

- Session mass-revoke
- Bulk approval rejection
- Seed policy changes
- Marking findings resolved via remediation

Automatic without approval: read-only audits, playbook fetch, admin notifications.
