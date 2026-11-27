# DARFIX agent API permissions

## Pipeline

Incoming → Field Ops lead → Dispatch → Tech assist → Support + BI; **Security Guardian** audits continuously and reports to Field Ops / admin. Specialists report back to Field Ops lead.

## Matrix

| Agent | Allowed tools | Autonomous writes | Needs human approval |
| --- | --- | --- | --- |
| Field Ops lead | health, queue/overview (read), list/decide approvals, peer coordination | Approve/reject proposals | — |
| Dispatch | health, queue, confirm, first-time assign | Confirm, first assign | Reassign |
| Customer Support | health, customer status | — | Customer commitments |
| Field Coach | health, my jobs, field updates | Status / notes / checklist | — |
| Ops Analyst | health, queue, overview | — (read-only) | — |
| Growth Marketer | health, campaign calendar | Drafts only | Paid ads / live promos |
| **Security Guardian** | health, playbook, audit, findings, propose remediation | Audits + admin notifications | **All remediations** (sessions, seed policy, bulk rejects, resolve findings) |

All agents share one DARFIX backend (`DARFIX_API_URL`). Credentials via env — no hardcoded passwords in agent bundles.
