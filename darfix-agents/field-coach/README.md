# DARFIX Ops Crew

A team of AI agents that **operate** the DARFIX home-maintenance service via its live API.

> Facebook reference video could not be fetched from this environment (login wall / blocked). This crew follows the common pattern of a multi-agent workforce: a shift lead plus specialist roles that actually run bookings, dispatch, support, and field updates.

## Team

| Role | Path | Job |
| --- | --- | --- |
| **Shift lead** | this agent | Routes work, coordinates the crew |
| **Dispatcher** | `bot/subagents/dispatcher` | Confirm bookings, assign technicians |
| **Support** | `bot/subagents/support` | Customer status / ETA explanations |
| **Field coach** | `bot/subagents/field_coach` | Technician status, notes, checklist |
| **Ops analyst** | `bot/subagents/ops_analyst` | KPIs and morning briefing |

## Prerequisites

1. DARFIX API running (`cd ../darfix && npm run dev` → API on `:8787`).
2. Cursor credential for model turns (`npx @grok/agent-sdk login` or `CURSOR_API_KEY`).

Optional: `export DARFIX_API_URL=http://127.0.0.1:8787`

## Run

```bash
cd darfix-ops-crew
npm install
npx @grok/agent-sdk validate --dir .
npx @grok/agent-sdk tool call darfix_health --dir . --input '{}'
npx @grok/agent-sdk tool call darfix_overview --dir . --input '{}'
npx @grok/agent-sdk serve --dir . --mode single --dev
# Playground: http://127.0.0.1:3000/playground
```

Example prompts in the playground:

- “Clear the dispatch queue.”
- “Where is my technician for bk-1001?”
- “Mark Mohammed arrived on bk-1001 with a progress note.”
- “Give me the morning ops briefing.”

## Tools → DARFIX API

| Tool | DARFIX effect |
| --- | --- |
| `darfix_health` | `GET /api/health` |
| `darfix_overview` | admin bootstrap + aggregates |
| `darfix_dispatch_queue` | unassigned / new jobs + suggestions |
| `darfix_confirm_booking` | confirm status |
| `darfix_assign_technician` | assign / auto-pick |
| `darfix_customer_status` | customer bootstrap view |
| `darfix_tech_update` | status / note / checklist |

Demo accounts used by tools: `admin@` / `tech@` / `customer@darfix.sa` (`demo123`).

## Schedule

`bot/schedules/morning-briefing.md` — daily 06:00 Asia/Riyadh (fires when deployed / not under `--dev` auto-fire).
