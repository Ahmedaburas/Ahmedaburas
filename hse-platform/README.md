# HSE Ledger

Operations register for a steel fabrication yard: incidents, behavior observations, task risk assessments, permits to work, inspections, corrective actions, training cards, and heat-stress readings.

The yard clock and date comparisons use **Asia/Riyadh**. The copy and people in a fresh database are sample data, not a live site record.

## Run

Requires Node.js 22.13 or newer. SQLite is the built-in `node:sqlite` module, so there is nothing to install.

```bash
cd hse-platform
npm start
```

Open http://127.0.0.1:4780 . Set `PORT` and `HOST` to change the bind address. The database file is created at `hse-platform/data/hse.sqlite` on first start.

```bash
npm test
```

## What it tracks

- Incidents, with recordable and lost-time flags. Closing an incident requires an investigation note. A lost-time injury is always recordable, and those flags apply only to injuries.
- Safe and at-risk observations.
- Risk assessments on a 5×5 matrix (1–4 low, 5–9 medium, 10–16 high, 17–25 extreme).
- Permits: requested → issued → active, with suspend, reject, and close.
- Inspections from workshop, welding, lifting, and fire checklists. Any failed item marks the inspection as actions required.
- Actions, highlighted once the due date has passed in Riyadh.
- Training cards and expiry.
- Heat index, with an alert at 42°C.

TRIR uses the OSHA base of 200,000 hours. LTIFR uses 1,000,000 hours. Both read the hours-worked figure on the yard board.

This is a single-user local register. It does not authenticate users and should not be exposed as a production system without an access control layer in front of it.
