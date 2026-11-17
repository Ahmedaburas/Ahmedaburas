import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { riyadhToday } from './dates.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS counters (
  prefix TEXT PRIMARY KEY,
  n INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  reported_by TEXT NOT NULL,
  status TEXT NOT NULL,
  recordable INTEGER NOT NULL DEFAULT 0,
  lti INTEGER NOT NULL DEFAULT 0,
  immediate_action TEXT NOT NULL DEFAULT '',
  investigation TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  observer TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS risk_assessments (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  task TEXT NOT NULL,
  area TEXT NOT NULL,
  assessor TEXT NOT NULL,
  assessed_on TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS risk_hazards (
  id INTEGER PRIMARY KEY,
  assessment_id INTEGER NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
  hazard TEXT NOT NULL,
  consequence TEXT NOT NULL,
  likelihood INTEGER NOT NULL,
  severity INTEGER NOT NULL,
  controls TEXT NOT NULL,
  residual_likelihood INTEGER NOT NULL,
  residual_severity INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS permits (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  issuer TEXT NOT NULL,
  acceptor TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  status TEXT NOT NULL,
  controls TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inspections (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  template TEXT NOT NULL,
  area TEXT NOT NULL,
  inspector TEXT NOT NULL,
  inspected_on TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inspection_items (
  id INTEGER PRIMARY KEY,
  inspection_id INTEGER NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  result TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  owner TEXT NOT NULL,
  due_on TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS training (
  id INTEGER PRIMARY KEY,
  person TEXT NOT NULL,
  course TEXT NOT NULL,
  completed_on TEXT NOT NULL,
  expires_on TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS heat_readings (
  id INTEGER PRIMARY KEY,
  recorded_at TEXT NOT NULL,
  location TEXT NOT NULL,
  heat_index_c REAL NOT NULL
);
`;

export function openDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

export function withTx(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* the connection may already be rolled back */
    }
    throw error;
  }
}

export function nextRef(db, prefix) {
  const key = `${prefix}-${riyadhToday().slice(0, 4)}`;
  const row = db.prepare('SELECT n FROM counters WHERE prefix = ?').get(key);
  const n = (row?.n ?? 0) + 1;
  db.prepare(
    `INSERT INTO counters(prefix, n) VALUES(?, ?)
     ON CONFLICT(prefix) DO UPDATE SET n = excluded.n`,
  ).run(key, n);
  return `${key}-${String(n).padStart(3, '0')}`;
}

export function defaultDbPath() {
  return path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'hse.sqlite');
}
