import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { seed } from "./seed.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  job_title TEXT NOT NULL,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  department_id INTEGER NOT NULL REFERENCES departments(id)
);
CREATE TABLE IF NOT EXISTS near_misses (
  id INTEGER PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  reported_by INTEGER NOT NULL REFERENCES people(id),
  occurred_at TEXT NOT NULL,
  location_detail TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  potential_consequence TEXT NOT NULL DEFAULT '',
  immediate_action TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  reported_by INTEGER NOT NULL REFERENCES people(id),
  occurred_at TEXT NOT NULL,
  location_detail TEXT NOT NULL DEFAULT '',
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  injured_name TEXT NOT NULL DEFAULT '',
  body_part TEXT NOT NULL DEFAULT '',
  days_lost INTEGER NOT NULL DEFAULT 0,
  immediate_action TEXT NOT NULL DEFAULT '',
  root_cause TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audits (
  id INTEGER PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  audit_type TEXT NOT NULL,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  lead_auditor INTEGER NOT NULL REFERENCES people(id),
  scheduled_date TEXT NOT NULL,
  completed_date TEXT,
  scope TEXT NOT NULL DEFAULT '',
  score INTEGER,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  audit_id INTEGER NOT NULL REFERENCES audits(id),
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES people(id),
  due_date TEXT NOT NULL,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS permits (
  id INTEGER PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  permit_type TEXT NOT NULL,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  requester_id INTEGER NOT NULL REFERENCES people(id),
  issuer_id INTEGER REFERENCES people(id),
  location_detail TEXT NOT NULL DEFAULT '',
  work_description TEXT NOT NULL DEFAULT '',
  hazards TEXT NOT NULL DEFAULT '',
  controls TEXT NOT NULL DEFAULT '',
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jsas (
  id INTEGER PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  job_title TEXT NOT NULL,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  prepared_by INTEGER NOT NULL REFERENCES people(id),
  reviewed_by INTEGER REFERENCES people(id),
  task_description TEXT NOT NULL DEFAULT '',
  ppe TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jsa_steps (
  id INTEGER PRIMARY KEY,
  jsa_id INTEGER NOT NULL REFERENCES jsas(id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL,
  task_step TEXT NOT NULL,
  hazard TEXT NOT NULL,
  controls TEXT NOT NULL,
  risk_before TEXT NOT NULL,
  risk_after TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS risk_assessments (
  id INTEGER PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  assessor_id INTEGER NOT NULL REFERENCES people(id),
  activity TEXT NOT NULL,
  status TEXT NOT NULL,
  review_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS risk_hazards (
  id INTEGER PRIMARY KEY,
  risk_id INTEGER NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
  hazard TEXT NOT NULL,
  consequence TEXT NOT NULL DEFAULT '',
  likelihood INTEGER NOT NULL,
  severity INTEGER NOT NULL,
  controls TEXT NOT NULL DEFAULT '',
  residual_likelihood INTEGER NOT NULL,
  residual_severity INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  source_reference TEXT NOT NULL,
  title TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES people(id),
  due_date TEXT NOT NULL,
  status TEXT NOT NULL,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS status_events (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id INTEGER REFERENCES people(id),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hours_worked (
  id INTEGER PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  month TEXT NOT NULL,
  hours INTEGER NOT NULL,
  UNIQUE (site_id, month)
);
CREATE INDEX IF NOT EXISTS idx_nm_occurred ON near_misses(occurred_at);
CREATE INDEX IF NOT EXISTS idx_inc_occurred ON incidents(occurred_at);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status, due_date);
CREATE INDEX IF NOT EXISTS idx_events ON status_events(entity_type, entity_id);
`;

export function openDatabase() {
  const configured = process.env.HSE_DB;
  const dbPath = configured || path.join(root, "data", "hse.sqlite");
  if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);
  const count = db.prepare("SELECT COUNT(*) AS n FROM sites").get().n;
  if (count === 0) seed(db);
  return db;
}

export function insertRow(db, table, row) {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map((key) => `:${key}`).join(",")})`;
  return Number(db.prepare(sql).run(row).lastInsertRowid);
}
