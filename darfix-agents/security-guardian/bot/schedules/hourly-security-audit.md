---
cron: "15 * * * *"
timezone: Asia/Riyadh
description: Hourly DARFIX security audit with admin notify on high/critical findings.
---

Run the Security Guardian continuous check:

1. Call `darfix_security_playbook` to load the latest checklist version.
2. Call `darfix_security_audit` with notify=true.
3. If any critical or high findings exist, call `darfix_security_findings` and for each `autoFixable` finding call `darfix_security_propose_remediation` with a clear rationale.
4. Summarize alerts for the admin. Do not approve remediations yourself.
