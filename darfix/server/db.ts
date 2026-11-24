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
  `)
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
