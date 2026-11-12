# Inma Steel · HSE reporting platform

Local health, safety, and environment workspace for Inma Steel Fabricators — near misses, incidents, audits, work permits, job safety analysis, and risk assessments. Brand colours and the company logo follow [inmasteel.com.sa](https://inmasteel.com.sa/). A dashboard reads those records live and every figure links back to the rows it counts.

Data is stored in a SQLite file on this machine (`data/hse.sqlite`). The app creates and seeds that file on first launch. No external services or secrets are required. Node.js 22 or newer is required.

The profile note `Jr. Data Analyst.md` is left as it was.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173. The API listens on http://127.0.0.1:3001 and the dev server proxies `/api` to it.

To serve the built app from one process:

```bash
npm run build
npm start
```

Open http://127.0.0.1:3001.

Delete `data/hse.sqlite` and start again to restore the sample data. `npm run check` confirms that each dashboard figure matches the list it links to.

## Routes

| Route | What it does |
| --- | --- |
| `/` | KPI dashboard |
| `/near-misses` | List and filter near misses |
| `/near-misses/new` | Report a near miss |
| `/near-misses/:id` | Open a near miss and move its status |
| `/incidents` | List and filter incidents |
| `/incidents/new` | Report an incident |
| `/incidents/:id` | Open an incident, record a root cause, move status |
| `/audits` | List and filter audits |
| `/audits/new` | Plan an audit |
| `/audits/:id` | Open an audit, add findings, move status |
| `/findings` | List audit findings across audits |
| `/findings/:id` | Open a finding and move its status |
| `/permits` | List and filter permits to work |
| `/permits/new` | Draft or request a permit |
| `/permits/:id` | Open a permit and move its status |
| `/jsa` | List job safety analyses |
| `/jsa/new` | Write a JSA |
| `/jsa/:id` | Open a JSA, including its steps, and move status |
| `/risks` | List risk assessments |
| `/risks/new` | Write a risk assessment |
| `/risks/:id` | Open an assessment, including hazard scores, and move status |
| `/actions` | List corrective actions from every module |
| `/actions/:id` | Open an action and move its status |
| `/directory` | Shared sites, departments, and people |

List pages accept `siteId`, `departmentId`, `status`, `from`, `to`, and `q`. Module pages also accept their own filters (`severity`, `category`, `incidentType`, `permitType`, `auditType`, `rating`).

Status moves:

- Near miss: draft → submitted → under review → actions open → closed
- Incident: draft → reported → investigating → actions open → closed
- Audit: planned → in progress → findings open → closed
- Finding: open ↔ in progress → closed, and closed can reopen
- Permit: draft → requested → approved → active → closed, with reject and suspend
- JSA: draft ↔ in review → approved → expired or superseded
- Risk: draft ↔ in review → approved → review due → archived
- Action: open ↔ in progress → closed, and closed can reopen

## How each KPI links to its records

The default period is the last 12 months through today. Site and department filters are added to the links below when they are selected. Workload figures ignore the period because they describe what is open now.

| Figure | Goes to |
| --- | --- |
| Near misses | `/near-misses` for the period |
| Incidents | `/incidents` for the period |
| Proactive reporting | The near-miss count and the incident count, each to its own list |
| Near misses per incident | The same two lists |
| TRIR | `/incidents?recordable=1` (medical treatment, lost time, and serious) |
| LTIR | `/incidents?lostTime=1` |
| Incident closure | Closed incidents, and all incidents in the period |
| Audits | `/audits` scheduled in the period |
| Open actions | `/actions?open=1` (open and in progress) |
| Overdue actions | `/actions?overdue=1` |
| Overdue permits | `/permits?overdue=1` (approved, active, or suspended, and past valid-to) |
| Open audit findings | `/findings?open=1` |
| High and critical risks | `/risks` on the current register (`in_review`, `approved`, `review_due`) with residual rating high or critical |
| Risks past review | `/risks?reviewDue=1` |
| JSAs past review | `/jsa?stale=1` (expired, or approved and past valid-until) |
| A month on the trend | That month’s near misses or incidents, clipped to the selected period |
| A site or department bar | That slice of near misses, incidents, or open actions |
| A severity or rating row | That band: near misses and incidents for the period, open findings, or the current risk register |
| A permit, audit, or JSA status tile | Records in that status. Audit tiles also keep the period. Permit and JSA tiles are the current set |

Risk bands use the highest residual score on the assessment: 1–4 low, 5–9 medium, 10–16 high, 17–25 critical. Hours for TRIR and LTIR are monthly site totals for each month the period touches, and they are not split by department.
