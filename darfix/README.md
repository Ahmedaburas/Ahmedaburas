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

### Pilot / single-process production

Build the SPA then serve API + static assets on one port (default `8787`, or `PORT`):

```bash
npm run start:pilot
# or: npm run build && npm start
```

Open `http://127.0.0.1:8787` (frontend + `/api`). Dev mode still uses Vite proxy on `:5173` → API `:8787`.

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

## Partner subscription payments (Mada / Visa / Mastercard)

Subscription fees are collected by **DARFIX (the SaaS owner)** through a KSA PSP and settle to the **owner’s merchant IBAN**. Partner companies subscribe and pay by card **without uploading CR/business certificates into DARFIX for payment** — PSP KYC is between the platform merchant and the bank/PSP, not forced on each maintenance company in-app.

Honest constraint: Saudi card acquiring still requires the **platform merchant** (you) to complete PSP onboarding. That is not “zero KYC forever,” and DARFIX does not help evade bank/PSP rules. Some PSPs offer **individual / freelance** merchant accounts (national ID + IBAN) rather than company CR — confirm current eligibility with the PSP.

**Recommended PSPs (KSA, Mada + Visa + Mastercard):**

1. **Moyasar** (preferred in code) — [moyasar.com](https://moyasar.com)  
2. **Tap Payments** — alternative; same merchant-of-record model

**Owner setup (Ahmed):**

1. Open Moyasar (or Tap) and choose individual/freelance merchant if available, else company.  
2. Complete their KYC (ID/IBAN and/or CR as the PSP requires).  
3. Connect your bank IBAN for settlement (“to my account”).  
4. Copy publishable + secret keys into secrets — never commit them. Bind names: `MOYASAR_SECRET_KEY`, `MOYASAR_PUBLISHABLE_KEY` (or Tap equivalents).  
5. Set `DARFIX_PUBLIC_URL` to the public app origin for invoice callbacks.

**Partners see:** `/partners` pricing + `/provider/billing` — Pay with Mada/Visa/Mastercard. After Founding **14-day** trial, paywall until checkout marks `subscription_status=active`, clears `trial_ends_at`, and sets the chosen plan. Seat limits already enforced.

**Local/dev:** without `MOYASAR_SECRET_KEY`, checkout uses **mock** mode (`POST /api/org/subscription/checkout` then auto-simulate from the billing UI, or `…/simulate`).

See store doc `docs/darfix-subscription-payments.md` for a fuller merchant guide.

## Stack

Vite + React 19 + TypeScript + Tailwind v4 · Express + better-sqlite3 · EN/AR RTL
