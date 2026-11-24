# DARFIX

Premium home maintenance SaaS for Saudi Arabia — plumbing and electrical bookings for homeowners and tenants, with technician workflows and an admin operations dashboard.

## Quick start

```bash
cd darfix
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build   # typecheck + production build
npm run preview # serve the production build
```

## Demo accounts

Password for all: `demo123`

| Role        | Email                 |
|-------------|-----------------------|
| Customer    | `customer@darfix.sa` |
| Technician  | `tech@darfix.sa`     |
| Admin       | `admin@darfix.sa`    |

Use the quick-login cards on the login page. State is shared via `localStorage` — a booking created as a customer appears for admin, assignment reaches the technician, and status/notification updates flow back to the customer.

Reset demo data from **Admin → Overview → Reset demo data**.

## Features

- **Customer:** sign up/login, book plumbing or electrical jobs (problem → photos → address → schedule → fee → submit), track status, view technician, approve extra work, pay invoices (mock), rate reviews, WhatsApp support.
- **Technician:** assigned jobs, customer location/contact, status updates, before/after photos, materials & labor costs, extra-work requests, final job report.
- **Admin:** overview KPIs, booking assign/reassign, customers, technicians, pricing overrides, reviews, discount codes, reports.
- **i18n:** English / Arabic with full RTL layout and language switcher.
- **Saudi market:** SAR pricing, Saudi cities/districts, `+966` phones.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4
- React Router
- `localStorage` persistence (no backend required)

## Project structure

```
src/
  adapters/     # payments, notifications, maps (mock implementations)
  config/       # service categories & Saudi cities (data-driven)
  i18n/         # EN/AR dictionaries
  store/        # types, seed data, React context + localStorage
  components/   # shared UI
  pages/        # landing, auth, customer, technician, admin
```

## Extension points

| Concern        | Interface / config                         | Swap-in later                          |
|----------------|--------------------------------------------|----------------------------------------|
| Payments       | `src/adapters/payments.ts`                 | Moyasar, Tap, Stripe                   |
| Notifications  | `src/adapters/notifications.ts`            | WhatsApp Business API, SMS, push       |
| Maps           | `src/adapters/maps.ts`                     | Google Maps / Mapbox                   |
| Categories     | `src/config/services.ts`                   | Add AC, cleaning, etc. (v1 = plumbing + electrical only) |
| Persistence    | `src/store/store.tsx` (`STORAGE_KEY`)      | API / SQLite backend                   |

Only plumbing and electrical ship in v1 by design.

## Booking statuses

New request → Confirmed → Technician assigned → On the way → Arrived → In progress → Awaiting customer approval → Completed / Cancelled.
