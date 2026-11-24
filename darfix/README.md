# DARFIX

Premium home maintenance SaaS for Saudi Arabia — plumbing and electrical bookings for homeowners and tenants, with technician workflows and an admin operations dashboard.

## AI ops crew

A multi-agent team that operates this API lives in sibling folder [`../darfix-ops-crew`](../darfix-ops-crew):

- **Shift lead** + subagents: dispatcher, support, field coach, ops analyst
- Tools call this Express API (confirm, assign, status, field updates)
- See `darfix-ops-crew/README.md` for playground commands

## Quick start

```bash
cd darfix
npm install
npm run dev
```

This starts:

- **API** (Express + SQLite) on `http://127.0.0.1:8787`
- **Web** (Vite) on `http://127.0.0.1:5173` (proxies `/api` → API)

```bash
npm run build   # frontend typecheck + production build
npm run start   # API only (after build, serve static separately if needed)
```

SQLite database file: `data/darfix.sqlite` (created automatically and seeded on first run).

## Demo accounts

Password for all: `demo123`

| Role        | Email                 |
|-------------|-----------------------|
| Customer    | `customer@darfix.sa` |
| Technician  | `tech@darfix.sa`     |
| Admin       | `admin@darfix.sa`    |

Use the quick-login cards on the login page. State is shared through the **SQLite backend** — a booking created as a customer appears for admin, assignment reaches the technician, and status/notification updates flow back to the customer (UI also polls every 8s).

Reset demo data from **Admin → Overview → Reset demo data**.

## Features

- **Customer:** sign up/login, book plumbing or electrical jobs, live process tracker (pipeline, ETA, checklist, progress notes), approve extra work, pay invoices (mock), rate reviews, WhatsApp support.
- **Technician:** assigned jobs, customer location/contact, status updates with notes, checklist, progress notes, before/after photos, materials & labor, extra-work requests, final job report.
- **Admin:** overview KPIs, booking assign/reassign, process visibility, customers, technicians, pricing overrides, reviews, discount codes, reports.
- **i18n:** English / Arabic with full RTL layout and language switcher.
- **Saudi market:** SAR pricing, Saudi cities/districts, `+966` phones.

## Stack

- **Frontend:** Vite + React 19 + TypeScript + Tailwind CSS v4 + React Router
- **Backend:** Express + better-sqlite3 + session tokens (Bearer)
- **Adapters (mock):** payments, notifications, maps — swap later for real providers

## Project structure

```
darfix/
  server/           # Express API, SQLite schema, seed
  data/             # SQLite DB (gitignored)
  src/
    api/            # Frontend API client
    adapters/       # payments, notifications, maps
    config/         # service categories & Saudi cities
    i18n/           # EN/AR dictionaries
    store/          # React context (API-backed)
    components/     # shared UI + ProcessTracker
    pages/          # landing, auth, customer, technician, admin
```

## API overview

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | email/password → token |
| POST | `/api/auth/signup` | create customer |
| GET | `/api/bootstrap` | full role-scoped state |
| POST | `/api/bookings` | create booking |
| PATCH | `/api/bookings/:id/status` | status + process timestamps |
| POST | `/api/bookings/:id/assign` | admin assign tech |
| POST | `/api/bookings/:id/process/note` | progress note |
| PATCH | `/api/bookings/:id/process/checklist` | toggle checklist |
| POST | `/api/demo/reset` | admin reseeds DB |

Auth: `Authorization: Bearer <token>`.

## Extension points

| Concern        | Where                                      | Swap-in later                    |
|----------------|--------------------------------------------|----------------------------------|
| Payments       | `src/adapters/payments.ts` + pay endpoint  | Moyasar, Tap, Stripe             |
| Notifications  | `src/adapters/notifications.ts` + server `notify()` | WhatsApp Business, SMS, push |
| Maps           | `src/adapters/maps.ts`                     | Google Maps / Mapbox             |
| Categories     | `src/config/services.ts`                   | Add AC, cleaning (v1 = plumbing + electrical only) |
| Persistence    | `server/db.ts` (SQLite)                    | Postgres / hosted DB             |

## Booking statuses

New request → Confirmed → Technician assigned → On the way → Arrived → In progress → Awaiting customer approval → Completed / Cancelled.
