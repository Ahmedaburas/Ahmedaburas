# DARFIX agent API permissions

## Pipeline

Incoming → Shift Lead → Dispatcher (confirm → assign) → Field Coach (progress) → Customer Support (status/ETA) + Ops Analyst (KPI). Specialists report back to Shift Lead.

## Matrix

| Agent | Allowed tools | Autonomous writes | Needs shift-lead approval |
| --- | --- | --- | --- |
| Shift Lead | health, queue (read), overview (read), list/decide approvals, peer coordination | Approve/reject proposals | — |
| Dispatcher | health, queue, confirm, first-time assign | Confirm, first assign | Reassign |
| Customer Support | health, customer status | — | Customer commitments |
| Field Coach | health, my jobs, field updates | Status / notes / checklist | — |
| Ops Analyst | health, queue, overview | — (read-only) | — |

All agents share one DARFIX backend (`DARFIX_API_URL`). No separate operational stores.
