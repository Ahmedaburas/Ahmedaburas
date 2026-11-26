# DARFIX

**B2B SaaS Growth & AI Operating System** for maintenance companies — with an integrated demand marketplace. Launch geography: **Eastern Province** (Khobar, Dhahran, Dammam, Jubail).

DARFIX does **not** sell itself as a maintenance operator. It sells **growth, jobs, visibility, and operational control** to partner companies.

## Product pillars

1. Digital storefront  
2. Lead engine (limited 1–3 offers with deadlines)  
3. Dispatch system  
4. AI Control Tower  
5. Technician network OS  

## Interfaces

| Surface | Who | Job |
| --- | --- | --- |
| Customer Portal | Homeowners / tenants | Request → match partner → track → approve quote → pay → rate |
| Company Dashboard | Partner owners | Lead inbox, pipeline, staff assign, price approvals, Control Tower, plan badge |
| Technician App | Field techs | Accept/reject → GPS on active jobs → quote → complete |
| AI Control Tower | Partner + Field Ops agents | Alerts, dispatch suggestions, approval gates |

## AI Control Tower (`../darfix-agents`)

Agents serve **partner companies** (Field Ops lead ≈ Shift Lead; Dispatch; Tech workflow assist; Customer updates; BI). See [`../darfix-agents/README.md`](../darfix-agents/README.md).

## Quick start

```bash
cd darfix
npm install
npm run dev
```

- **API** `http://127.0.0.1:8787`
- **Web** `http://localhost:5173`

```bash
npm run build
```

## Demo accounts

Password: `demo123`

| Role | Email |
| --- | --- |
| Customer (Khobar) | `customer@darfix.sa` |
| Independent technician | `tech@darfix.sa` |
| Founding partner (Eastern Home Care) | `company@darfix.sa` |
| Partner (Dammam Fix Pros) | `dammam@darfix.sa` |
| Admin | `admin@darfix.sa` |

Partner pricing (proposed): Launch free (1 seat) · Growth 149 (3) · Pro 399 (10) · Business 799 (25) · Enterprise 1500–3500+ (unlimited) SAR/mo. Founding 20: **14-day** Pro free trial (env `DARFIX_TRIAL_DAYS`, suggest 7–14), then 299 for 12 months.

## Stack

Vite + React 19 + TypeScript + Tailwind v4 · Express + better-sqlite3 · EN/AR RTL
