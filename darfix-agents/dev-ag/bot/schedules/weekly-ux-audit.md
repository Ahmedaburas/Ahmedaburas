---
cron: "0 9 * * 1"
timezone: Asia/Riyadh
description: Weekly Dev.Ag UX and product gap audit (Monday 09:00 Riyadh).
---

Run a Dev.Ag product audit:

1. Call `darfix_health`.
2. Call `darfix_ux_audit`.
3. Call `darfix_dev_report_outline` with focus=all.
4. Write a concise P0/P1/P2 report with recommended fixes. Do not invent credentials.
