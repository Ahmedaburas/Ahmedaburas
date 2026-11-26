# DARFIX Security Guardian

Continuous **defensive** security peer for the DARFIX Growth OS.

- Audits frontend / backend / transport / data / agents signals
- Notifies admins on critical/high findings
- Proposes remediations that **require human approval**
- Pulls a versioned playbook from the API so guidance stays current

## Run

```bash
# API with admin env (required)
export DARFIX_ADMIN_EMAIL='you@example.com'
export DARFIX_ADMIN_PASSWORD='…'
export DARFIX_SECRET='…'   # pilot/prod

cd ../darfix && npm run dev

# Mount all peers (includes security-guardian)
cd ../darfix-agents
npx @grok/agent-sdk dev .
# http://127.0.0.1:3000/security-guardian
```

## Tools

| Tool | Purpose |
| --- | --- |
| `darfix_security_playbook` | Self-update checklist |
| `darfix_security_audit` | Scan + notify |
| `darfix_security_findings` | List findings |
| `darfix_security_propose_remediation` | Approval-gated fix |
| `darfix_list_approvals` / `darfix_decide_approval` | Human-driven decisions only |

Schedule: `bot/schedules/hourly-security-audit.md`
