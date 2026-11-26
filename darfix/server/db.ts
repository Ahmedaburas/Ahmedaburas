import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
const dbPath = path.join(dataDir, 'darfix.sqlite')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

/** Bump when seed shape changes so existing DBs reseed on next start. */
export const SEED_VERSION = 'ep-b2b-growth-os-2'

function hasColumn(table: string, column: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return cols.some((c) => c.name === column)
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      city_id TEXT,
      district_id TEXT,
      specialties TEXT,
      rating REAL,
      review_count INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      avatar_color TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES users(id),
      technician_id TEXT REFERENCES users(id),
      category_id TEXT NOT NULL,
      problem_id TEXT NOT NULL,
      description TEXT NOT NULL,
      photos TEXT NOT NULL DEFAULT '[]',
      address TEXT NOT NULL,
      preferred_date TEXT NOT NULL,
      preferred_time_slot TEXT NOT NULL,
      estimated_fee_sar REAL NOT NULL,
      status TEXT NOT NULL,
      costs TEXT NOT NULL DEFAULT '[]',
      extra_work TEXT NOT NULL DEFAULT '[]',
      job_report TEXT,
      rating INTEGER,
      review_text TEXT,
      reviewed_at TEXT,
      discount_code TEXT,
      discount_amount_sar REAL,
      process TEXT NOT NULL DEFAULT '{}',
      status_history TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title_en TEXT NOT NULL,
      title_ar TEXT NOT NULL,
      body_en TEXT NOT NULL,
      body_ar TEXT NOT NULL,
      booking_id TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      lines TEXT NOT NULL,
      total_sar REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      customer_id TEXT NOT NULL REFERENCES users(id),
      lines TEXT NOT NULL,
      total_sar REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      paid_at TEXT
    );

    CREATE TABLE IF NOT EXISTS discount_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      percent_off REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      max_uses INTEGER NOT NULL,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pricing_overrides (
      category_id TEXT NOT NULL,
      problem_id TEXT NOT NULL,
      base_fee_sar REAL NOT NULL,
      PRIMARY KEY (category_id, problem_id)
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_approvals (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      booking_id TEXT,
      payload TEXT NOT NULL DEFAULT '{}',
      rationale TEXT NOT NULL,
      proposed_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      decided_by TEXT,
      decision_note TEXT,
      created_at TEXT NOT NULL,
      decided_at TEXT
    );

    CREATE TABLE IF NOT EXISTS provider_organizations (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      city_id TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      commercial_registration TEXT,
      license_number TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organization_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      member_role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(organization_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS lead_offers (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'offered',
      offer_round INTEGER NOT NULL DEFAULT 1,
      offered_at TEXT NOT NULL,
      deadline_at TEXT NOT NULL,
      responded_at TEXT
    );
  `)

  if (!hasColumn('users', 'employment_type')) {
    db.exec(`ALTER TABLE users ADD COLUMN employment_type TEXT`)
  }
  if (!hasColumn('users', 'organization_id')) {
    db.exec(`ALTER TABLE users ADD COLUMN organization_id TEXT`)
  }
  if (!hasColumn('bookings', 'organization_id')) {
    db.exec(`ALTER TABLE bookings ADD COLUMN organization_id TEXT`)
  }
  if (!hasColumn('bookings', 'assignment_mode')) {
    db.exec(`ALTER TABLE bookings ADD COLUMN assignment_mode TEXT`)
  }
  if (!hasColumn('bookings', 'tech_response')) {
    db.exec(`ALTER TABLE bookings ADD COLUMN tech_response TEXT`)
  }
  if (!hasColumn('bookings', 'preferred_organization_id')) {
    db.exec(`ALTER TABLE bookings ADD COLUMN preferred_organization_id TEXT`)
  }
  if (!hasColumn('provider_organizations', 'subscription_plan')) {
    db.exec(`ALTER TABLE provider_organizations ADD COLUMN subscription_plan TEXT DEFAULT 'launch'`)
  }
  if (!hasColumn('provider_organizations', 'founding_partner')) {
    db.exec(`ALTER TABLE provider_organizations ADD COLUMN founding_partner INTEGER DEFAULT 0`)
  }
  if (!hasColumn('provider_organizations', 'service_city_ids')) {
    db.exec(`ALTER TABLE provider_organizations ADD COLUMN service_city_ids TEXT`)
  }
  if (!hasColumn('provider_organizations', 'trial_days')) {
    db.exec(`ALTER TABLE provider_organizations ADD COLUMN trial_days INTEGER`)
  }
  if (!hasColumn('provider_organizations', 'trial_ends_at')) {
    db.exec(`ALTER TABLE provider_organizations ADD COLUMN trial_ends_at TEXT`)
  }
  if (!hasColumn('provider_organizations', 'whatsapp')) {
    db.exec(`ALTER TABLE provider_organizations ADD COLUMN whatsapp TEXT`)
  }
  if (!hasColumn('provider_organizations', 'sla_hours')) {
    db.exec(`ALTER TABLE provider_organizations ADD COLUMN sla_hours INTEGER`)
  }
  if (!hasColumn('provider_organizations', 'tech_count_declared')) {
    db.exec(`ALTER TABLE provider_organizations ADD COLUMN tech_count_declared INTEGER`)
  }
  if (!hasColumn('provider_organizations', 'specialties')) {
    db.exec(`ALTER TABLE provider_organizations ADD COLUMN specialties TEXT`)
  }
  if (!hasColumn('provider_organizations', 'price_approver_name')) {
    db.exec(`ALTER TABLE provider_organizations ADD COLUMN price_approver_name TEXT`)
  }
  if (!hasColumn('provider_organizations', 'price_approver_phone')) {
    db.exec(`ALTER TABLE provider_organizations ADD COLUMN price_approver_phone TEXT`)
  }
  if (!hasColumn('provider_organizations', 'onboarding_survey')) {
    db.exec(`ALTER TABLE provider_organizations ADD COLUMN onboarding_survey TEXT`)
  }
  if (!hasColumn('provider_organizations', 'subscription_status')) {
    db.exec(
      `ALTER TABLE provider_organizations ADD COLUMN subscription_status TEXT DEFAULT 'none'`,
    )
  }
  // Idempotent: open-trial orgs that never checked out stay trialing (not active).
  db.exec(`
    UPDATE provider_organizations
    SET subscription_status = 'trialing'
    WHERE trial_ends_at IS NOT NULL
      AND trial_ends_at > datetime('now')
      AND subscription_status = 'none'
  `)
  if (!hasColumn('quotations', 'submitted_by')) {
    db.exec(`ALTER TABLE quotations ADD COLUMN submitted_by TEXT`)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_checkouts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES provider_organizations(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL,
      amount_sar REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'SAR',
      provider TEXT NOT NULL,
      external_id TEXT,
      checkout_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_by TEXT,
      created_at TEXT NOT NULL,
      paid_at TEXT,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_subscription_checkouts_org
      ON subscription_checkouts(organization_id);
    CREATE INDEX IF NOT EXISTS idx_subscription_checkouts_external
      ON subscription_checkouts(external_id);
  `)
  if (!hasColumn('quotations', 'company_note')) {
    db.exec(`ALTER TABLE quotations ADD COLUMN company_note TEXT`)
  }
  if (!hasColumn('users', 'technician_code')) {
    db.exec(`ALTER TABLE users ADD COLUMN technician_code TEXT`)
  }
  if (!hasColumn('users', 'last_active_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN last_active_at TEXT`)
  }
  if (!hasColumn('sessions', 'device_label')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN device_label TEXT`)
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_technician_code
      ON users(technician_code)
      WHERE technician_code IS NOT NULL
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS security_findings (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      surface TEXT NOT NULL,
      auto_fixable INTEGER NOT NULL DEFAULT 0,
      recommended_action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT,
      acknowledged_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_security_findings_status
      ON security_findings(status, severity);
  `)
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
