import {
  ENUMS,
  HttpError,
  PERMIT_OPEN_STATUSES,
  RECORDABLE_SEVERITIES,
  RISK_REGISTER_STATUSES,
  STATUS_LABELS,
  TRANSITIONS,
  camel,
  nowIso,
  optId,
  optText,
  reqDate,
  reqEnum,
  reqId,
  reqScore,
  reqText,
  riskBand,
  today,
} from "./domain.js";
import { insertRow } from "./db.js";

function searchClause(columns, q, clauses, params) {
  if (!q) return;
  const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  clauses.push(`(${columns.map((column) => `${column} LIKE ? ESCAPE '\\'`).join(" OR ")})`);
  for (let i = 0; i < columns.length; i += 1) params.push(like);
}

function scope(alias, filter, clauses, params) {
  if (filter.siteId) {
    clauses.push(`${alias}.site_id = ?`);
    params.push(filter.siteId);
  }
  if (filter.departmentId) {
    clauses.push(`${alias}.department_id = ?`);
    params.push(filter.departmentId);
  }
}

function dates(alias, column, filter, clauses, params) {
  if (filter.from) {
    clauses.push(`date(${alias}.${column}) >= date(?)`);
    params.push(filter.from);
  }
  if (filter.to) {
    clauses.push(`date(${alias}.${column}) <= date(?)`);
    params.push(filter.to);
  }
}

function statusIn(alias, filter, clauses, params) {
  if (!filter.status?.length) return;
  clauses.push(`${alias}.status IN (${filter.status.map(() => "?").join(",")})`);
  params.push(...filter.status);
}

function severityIn(alias, filter, clauses, params) {
  if (!filter.severity?.length) return;
  clauses.push(`${alias}.severity IN (${filter.severity.map(() => "?").join(",")})`);
  params.push(...filter.severity);
}

function where(clauses) {
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

function mustExist(db, table, id, label) {
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
  if (!row) throw new HttpError(400, `${label} was not found`);
}

function place(db, siteId, departmentId) {
  mustExist(db, "sites", siteId, "Site");
  mustExist(db, "departments", departmentId, "Department");
}

function person(db, id, label) {
  mustExist(db, "people", id, label);
}

function withTx(db, fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already closed */
    }
    throw error;
  }
}

function addEvent(db, entityType, entityId, fromStatus, toStatus, actorId, note, createdAt) {
  insertRow(db, "status_events", {
    entity_type: entityType,
    entity_id: entityId,
    from_status: fromStatus,
    to_status: toStatus,
    actor_id: actorId,
    note: note || "",
    created_at: createdAt,
  });
}

export function nextReference(db, table, prefix) {
  const year = new Date().getUTCFullYear();
  const row = db
    .prepare(`SELECT reference FROM ${table} WHERE reference LIKE ? ORDER BY reference DESC LIMIT 1`)
    .get(`${prefix}-${year}-%`);
  const current = row ? Number(String(row.reference).split("-").pop()) : 0;
  return `${prefix}-${year}-${String((Number.isFinite(current) ? current : 0) + 1).padStart(3, "0")}`;
}

const DAY = () => today();

export function listEvents(db, entityType, entityId) {
  return db
    .prepare(
      `SELECT e.*, p.name AS actor_name
       FROM status_events e
       LEFT JOIN people p ON p.id = e.actor_id
       WHERE e.entity_type = ? AND e.entity_id = ?
       ORDER BY e.created_at, e.id`,
    )
    .all(entityType, entityId)
    .map((row) => camel(row));
}

export function listSites(db) {
  return db.prepare("SELECT * FROM sites ORDER BY name").all().map((row) => camel(row));
}

export function listDepartments(db) {
  return db.prepare("SELECT * FROM departments ORDER BY name").all().map((row) => camel(row));
}

export function listPeople(db) {
  return db
    .prepare(
      `SELECT p.*, s.name AS site_name, d.name AS department_name
       FROM people p
       JOIN sites s ON s.id = p.site_id
       JOIN departments d ON d.id = p.department_id
       ORDER BY p.name`,
    )
    .all()
    .map((row) => camel(row));
}

export function listNearMisses(db, filter) {
  const clauses = [];
  const params = [];
  scope("n", filter, clauses, params);
  dates("n", "occurred_at", filter, clauses, params);
  statusIn("n", filter, clauses, params);
  severityIn("n", filter, clauses, params);
  if (filter.category) {
    clauses.push("n.category = ?");
    params.push(filter.category);
  }
  searchClause(["n.reference", "n.title", "n.description", "n.location_detail"], filter.q, clauses, params);
  return db
    .prepare(
      `SELECT n.*, s.name AS site_name, d.name AS department_name, p.name AS reported_by_name
       FROM near_misses n
       JOIN sites s ON s.id = n.site_id
       JOIN departments d ON d.id = n.department_id
       JOIN people p ON p.id = n.reported_by
       ${where(clauses)}
       ORDER BY n.occurred_at DESC, n.id DESC`,
    )
    .all(...params)
    .map((row) => camel(row));
}

export function getNearMiss(db, id) {
  const rows = listNearMisses(db, { siteId: null, departmentId: null, status: [], severity: [], q: "", category: null, from: null, to: null });
  const record = rows.find((row) => row.id === id);
  if (!record) return null;
  return {
    ...record,
    actions: listActions(db, { ...blankish(), sourceType: "near_miss", sourceId: id }),
    events: listEvents(db, "near_miss", id),
  };
}

function blankish() {
  return {
    siteId: null,
    departmentId: null,
    status: [],
    severity: [],
    q: "",
    from: null,
    to: null,
    open: false,
    overdue: false,
    sourceType: null,
    sourceId: null,
    rating: [],
  };
}

export function listIncidents(db, filter) {
  const clauses = [];
  const params = [];
  scope("i", filter, clauses, params);
  dates("i", "occurred_at", filter, clauses, params);
  statusIn("i", filter, clauses, params);
  severityIn("i", filter, clauses, params);
  if (filter.incidentType) {
    clauses.push("i.incident_type = ?");
    params.push(filter.incidentType);
  }
  if (filter.recordable) {
    clauses.push(`i.severity IN (${RECORDABLE_SEVERITIES.map(() => "?").join(",")})`);
    params.push(...RECORDABLE_SEVERITIES);
  }
  if (filter.lostTime) clauses.push("(i.severity = 'lost_time' OR i.days_lost > 0)");
  searchClause(["i.reference", "i.title", "i.description", "i.location_detail", "i.injured_name"], filter.q, clauses, params);
  return db
    .prepare(
      `SELECT i.*, s.name AS site_name, d.name AS department_name, p.name AS reported_by_name
       FROM incidents i
       JOIN sites s ON s.id = i.site_id
       JOIN departments d ON d.id = i.department_id
       JOIN people p ON p.id = i.reported_by
       ${where(clauses)}
       ORDER BY i.occurred_at DESC, i.id DESC`,
    )
    .all(...params)
    .map((row) => camel(row));
}

export function getIncident(db, id) {
  const row = db
    .prepare(
      `SELECT i.*, s.name AS site_name, d.name AS department_name, p.name AS reported_by_name
       FROM incidents i
       JOIN sites s ON s.id = i.site_id
       JOIN departments d ON d.id = i.department_id
       JOIN people p ON p.id = i.reported_by
       WHERE i.id = ?`,
    )
    .get(id);
  if (!row) return null;
  const record = camel(row);
  record.actions = listActions(db, { ...blankish(), sourceType: "incident", sourceId: id });
  record.events = listEvents(db, "incident", id);
  return record;
}

export function listAudits(db, filter) {
  const clauses = [];
  const params = [];
  scope("a", filter, clauses, params);
  dates("a", "scheduled_date", filter, clauses, params);
  statusIn("a", filter, clauses, params);
  if (filter.auditType) {
    clauses.push("a.audit_type = ?");
    params.push(filter.auditType);
  }
  searchClause(["a.reference", "a.title", "a.scope"], filter.q, clauses, params);
  return db
    .prepare(
      `SELECT a.*, s.name AS site_name, d.name AS department_name, p.name AS lead_auditor_name,
              (SELECT COUNT(*) FROM findings f WHERE f.audit_id = a.id AND f.status != 'closed') AS open_findings
       FROM audits a
       JOIN sites s ON s.id = a.site_id
       JOIN departments d ON d.id = a.department_id
       JOIN people p ON p.id = a.lead_auditor
       ${where(clauses)}
       ORDER BY a.scheduled_date DESC, a.id DESC`,
    )
    .all(...params)
    .map((row) => camel(row));
}

export function getAudit(db, id) {
  const row = db
    .prepare(
      `SELECT a.*, s.name AS site_name, d.name AS department_name, p.name AS lead_auditor_name
       FROM audits a
       JOIN sites s ON s.id = a.site_id
       JOIN departments d ON d.id = a.department_id
       JOIN people p ON p.id = a.lead_auditor
       WHERE a.id = ?`,
    )
    .get(id);
  if (!row) return null;
  const record = camel(row);
  record.findings = listFindings(db, { ...blankish(), auditId: id });
  record.openFindings = record.findings.filter((finding) => finding.status !== "closed").length;
  record.actions = listActions(db, { ...blankish(), sourceType: "audit", sourceId: id });
  record.events = listEvents(db, "audit", id);
  return record;
}

export function listFindings(db, filter) {
  const clauses = [];
  const params = [];
  const day = DAY();
  scope("f", filter, clauses, params);
  dates("f", "created_at", filter, clauses, params);
  statusIn("f", filter, clauses, params);
  severityIn("f", filter, clauses, params);
  if (filter.open) clauses.push("f.status != 'closed'");
  if (filter.auditId) {
    clauses.push("f.audit_id = ?");
    params.push(filter.auditId);
  }
  searchClause(["f.reference", "f.description", "a.reference", "a.title"], filter.q, clauses, params);
  return db
    .prepare(
      `SELECT f.*, s.name AS site_name, d.name AS department_name, p.name AS owner_name,
              a.reference AS audit_reference, a.title AS audit_title
       FROM findings f
       JOIN audits a ON a.id = f.audit_id
       JOIN sites s ON s.id = f.site_id
       JOIN departments d ON d.id = f.department_id
       JOIN people p ON p.id = f.owner_id
       ${where(clauses)}
       ORDER BY f.due_date ASC, f.id DESC`,
    )
    .all(...params)
    .map((row) => {
      const item = camel(row);
      item.overdue = item.status !== "closed" && item.dueDate < day;
      return item;
    });
}

export function getFinding(db, id) {
  const row = db
    .prepare(
      `SELECT f.*, s.name AS site_name, d.name AS department_name, p.name AS owner_name,
              a.reference AS audit_reference, a.title AS audit_title
       FROM findings f
       JOIN audits a ON a.id = f.audit_id
       JOIN sites s ON s.id = f.site_id
       JOIN departments d ON d.id = f.department_id
       JOIN people p ON p.id = f.owner_id
       WHERE f.id = ?`,
    )
    .get(id);
  if (!row) return null;
  const record = camel(row);
  record.overdue = record.status !== "closed" && record.dueDate < DAY();
  record.actions = listActions(db, { ...blankish(), sourceType: "finding", sourceId: id });
  record.events = listEvents(db, "finding", id);
  return record;
}

export function listPermits(db, filter) {
  const clauses = [];
  const params = [];
  const day = DAY();
  scope("p", filter, clauses, params);
  dates("p", "created_at", filter, clauses, params);
  statusIn("p", filter, clauses, params);
  if (filter.permitType) {
    clauses.push("p.permit_type = ?");
    params.push(filter.permitType);
  }
  if (filter.overdue) {
    clauses.push(`p.status IN (${PERMIT_OPEN_STATUSES.map(() => "?").join(",")}) AND date(p.valid_to) < date(?)`);
    params.push(...PERMIT_OPEN_STATUSES, day);
  }
  searchClause(["p.reference", "p.title", "p.work_description", "p.location_detail"], filter.q, clauses, params);
  return db
    .prepare(
      `SELECT p.*, s.name AS site_name, d.name AS department_name,
              r.name AS requester_name, i.name AS issuer_name
       FROM permits p
       JOIN sites s ON s.id = p.site_id
       JOIN departments d ON d.id = p.department_id
       JOIN people r ON r.id = p.requester_id
       LEFT JOIN people i ON i.id = p.issuer_id
       ${where(clauses)}
       ORDER BY p.created_at DESC, p.id DESC`,
    )
    .all(...params)
    .map((row) => {
      const item = camel(row);
      item.overdue = PERMIT_OPEN_STATUSES.includes(item.status) && item.validTo < day;
      return item;
    });
}

export function getPermit(db, id) {
  const row = db
    .prepare(
      `SELECT p.*, s.name AS site_name, d.name AS department_name,
              r.name AS requester_name, i.name AS issuer_name
       FROM permits p
       JOIN sites s ON s.id = p.site_id
       JOIN departments d ON d.id = p.department_id
       JOIN people r ON r.id = p.requester_id
       LEFT JOIN people i ON i.id = p.issuer_id
       WHERE p.id = ?`,
    )
    .get(id);
  if (!row) return null;
  const record = camel(row);
  record.overdue = PERMIT_OPEN_STATUSES.includes(record.status) && record.validTo < DAY();
  record.actions = listActions(db, { ...blankish(), sourceType: "permit", sourceId: id });
  record.events = listEvents(db, "permit", id);
  return record;
}

export function listJsas(db, filter) {
  const clauses = [];
  const params = [];
  const day = DAY();
  scope("j", filter, clauses, params);
  dates("j", "created_at", filter, clauses, params);
  statusIn("j", filter, clauses, params);
  if (filter.stale) {
    clauses.push("(j.status = 'expired' OR (j.status = 'approved' AND date(j.valid_until) < date(?)))");
    params.push(day);
  }
  searchClause(["j.reference", "j.job_title", "j.task_description"], filter.q, clauses, params);
  return db
    .prepare(
      `SELECT j.*, s.name AS site_name, d.name AS department_name,
              p.name AS prepared_by_name, r.name AS reviewed_by_name,
              (SELECT COUNT(*) FROM jsa_steps st WHERE st.jsa_id = j.id) AS step_count
       FROM jsas j
       JOIN sites s ON s.id = j.site_id
       JOIN departments d ON d.id = j.department_id
       JOIN people p ON p.id = j.prepared_by
       LEFT JOIN people r ON r.id = j.reviewed_by
       ${where(clauses)}
       ORDER BY j.created_at DESC, j.id DESC`,
    )
    .all(...params)
    .map((row) => {
      const item = camel(row);
      item.stale = item.status === "expired" || (item.status === "approved" && item.validUntil < day);
      return item;
    });
}

export function getJsa(db, id) {
  const row = db
    .prepare(
      `SELECT j.*, s.name AS site_name, d.name AS department_name,
              p.name AS prepared_by_name, r.name AS reviewed_by_name
       FROM jsas j
       JOIN sites s ON s.id = j.site_id
       JOIN departments d ON d.id = j.department_id
       JOIN people p ON p.id = j.prepared_by
       LEFT JOIN people r ON r.id = j.reviewed_by
       WHERE j.id = ?`,
    )
    .get(id);
  if (!row) return null;
  const record = camel(row);
  record.stale = record.status === "expired" || (record.status === "approved" && record.validUntil < DAY());
  record.steps = db
    .prepare("SELECT * FROM jsa_steps WHERE jsa_id = ? ORDER BY step_no")
    .all(id)
    .map((step) => camel(step));
  record.stepCount = record.steps.length;
  record.actions = listActions(db, { ...blankish(), sourceType: "jsa", sourceId: id });
  record.events = listEvents(db, "jsa", id);
  return record;
}

function mapRisk(row) {
  const item = camel(row);
  item.rating = riskBand(item.residualScore);
  return item;
}

export function listRisks(db, filter) {
  const clauses = [];
  const params = [];
  const day = DAY();
  scope("r", filter, clauses, params);
  dates("r", "created_at", filter, clauses, params);
  statusIn("r", filter, clauses, params);
  if (filter.reviewDue) {
    clauses.push("(r.status = 'review_due' OR (r.status = 'approved' AND date(r.review_date) < date(?)))");
    params.push(day);
  }
  searchClause(["r.reference", "r.title", "r.activity"], filter.q, clauses, params);
  let items = db
    .prepare(
      `SELECT r.*, s.name AS site_name, d.name AS department_name, p.name AS assessor_name,
              COALESCE((SELECT MAX(h.residual_likelihood * h.residual_severity) FROM risk_hazards h WHERE h.risk_id = r.id), 0) AS residual_score,
              COALESCE((SELECT MAX(h.likelihood * h.severity) FROM risk_hazards h WHERE h.risk_id = r.id), 0) AS inherent_score
       FROM risk_assessments r
       JOIN sites s ON s.id = r.site_id
       JOIN departments d ON d.id = r.department_id
       JOIN people p ON p.id = r.assessor_id
       ${where(clauses)}
       ORDER BY r.created_at DESC, r.id DESC`,
    )
    .all(...params)
    .map(mapRisk);
  if (filter.rating?.length) items = items.filter((item) => filter.rating.includes(item.rating));
  return items;
}

export function getRisk(db, id) {
  const row = db
    .prepare(
      `SELECT r.*, s.name AS site_name, d.name AS department_name, p.name AS assessor_name,
              COALESCE((SELECT MAX(h.residual_likelihood * h.residual_severity) FROM risk_hazards h WHERE h.risk_id = r.id), 0) AS residual_score,
              COALESCE((SELECT MAX(h.likelihood * h.severity) FROM risk_hazards h WHERE h.risk_id = r.id), 0) AS inherent_score
       FROM risk_assessments r
       JOIN sites s ON s.id = r.site_id
       JOIN departments d ON d.id = r.department_id
       JOIN people p ON p.id = r.assessor_id
       WHERE r.id = ?`,
    )
    .get(id);
  if (!row) return null;
  const record = mapRisk(row);
  record.reviewDue = record.status === "review_due" || (record.status === "approved" && record.reviewDate < DAY());
  record.hazards = db
    .prepare("SELECT * FROM risk_hazards WHERE risk_id = ? ORDER BY id")
    .all(id)
    .map((hazard) => {
      const item = camel(hazard);
      item.inherentScore = item.likelihood * item.severity;
      item.residualScore = item.residualLikelihood * item.residualSeverity;
      item.inherentRating = riskBand(item.inherentScore);
      item.residualRating = riskBand(item.residualScore);
      return item;
    });
  record.actions = listActions(db, { ...blankish(), sourceType: "risk", sourceId: id });
  record.events = listEvents(db, "risk", id);
  return record;
}

export function listActions(db, filter) {
  const clauses = [];
  const params = [];
  const day = DAY();
  scope("a", filter, clauses, params);
  dates("a", "created_at", filter, clauses, params);
  statusIn("a", filter, clauses, params);
  if (filter.open) clauses.push("a.status != 'closed'");
  if (filter.overdue) {
    clauses.push("a.status != 'closed' AND date(a.due_date) < date(?)");
    params.push(day);
  }
  if (filter.sourceType) {
    clauses.push("a.source_type = ?");
    params.push(filter.sourceType);
  }
  if (filter.sourceId) {
    clauses.push("a.source_id = ?");
    params.push(filter.sourceId);
  }
  searchClause(["a.reference", "a.title", "a.source_reference"], filter.q, clauses, params);
  return db
    .prepare(
      `SELECT a.*, s.name AS site_name, d.name AS department_name, p.name AS owner_name
       FROM actions a
       JOIN sites s ON s.id = a.site_id
       JOIN departments d ON d.id = a.department_id
       JOIN people p ON p.id = a.owner_id
       ${where(clauses)}
       ORDER BY a.due_date ASC, a.id DESC`,
    )
    .all(...params)
    .map((row) => {
      const item = camel(row);
      item.overdue = item.status !== "closed" && item.dueDate < day;
      return item;
    });
}

export function getAction(db, id) {
  const row = db
    .prepare(
      `SELECT a.*, s.name AS site_name, d.name AS department_name, p.name AS owner_name
       FROM actions a
       JOIN sites s ON s.id = a.site_id
       JOIN departments d ON d.id = a.department_id
       JOIN people p ON p.id = a.owner_id
       WHERE a.id = ?`,
    )
    .get(id);
  if (!row) return null;
  const record = camel(row);
  record.overdue = record.status !== "closed" && record.dueDate < DAY();
  record.events = listEvents(db, "action", id);
  return record;
}

export function hoursInPeriod(db, { from, to, siteId }) {
  const rows = db
    .prepare(
      `SELECT month, SUM(hours) AS hours
       FROM hours_worked
       WHERE (? IS NULL OR site_id = ?)
       GROUP BY month`,
    )
    .all(siteId, siteId);
  let total = 0;
  for (const row of rows) {
    const start = `${row.month}-01`;
    const [y, m] = row.month.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    if (start <= to && end >= from) total += row.hours;
  }
  return total;
}

function sharedPlace(db, body) {
  const siteId = reqId(body.siteId, "Site");
  const departmentId = reqId(body.departmentId, "Department");
  place(db, siteId, departmentId);
  return { siteId, departmentId };
}

export function createNearMiss(db, body) {
  const title = reqText(body.title, "Title", 160);
  const description = reqText(body.description, "Description");
  const { siteId, departmentId } = sharedPlace(db, body);
  const reportedBy = reqId(body.reportedBy, "Reported by");
  person(db, reportedBy, "Reported by");
  const occurredAt = reqDate(body.occurredAt, "Occurrence date", { notFuture: true });
  const category = reqEnum(body.category, ENUMS.nearMissCategory, "Category");
  const severity = reqEnum(body.severity, ENUMS.nearMissSeverity, "Severity");
  const status = body.status === "draft" ? "draft" : "submitted";
  const now = nowIso();
  const id = withTx(db, () => {
    const newId = insertRow(db, "near_misses", {
      reference: nextReference(db, "near_misses", "NM"),
      title,
      description,
      site_id: siteId,
      department_id: departmentId,
      reported_by: reportedBy,
      occurred_at: occurredAt,
      location_detail: optText(body.locationDetail, "Location", 200),
      category,
      severity,
      potential_consequence: optText(body.potentialConsequence, "Potential consequence"),
      immediate_action: optText(body.immediateAction, "Immediate action"),
      status,
      created_at: now,
      updated_at: now,
    });
    addEvent(db, "near_miss", newId, null, status, reportedBy, "Record created", now);
    return newId;
  });
  return getNearMiss(db, id);
}

export function createIncident(db, body) {
  const title = reqText(body.title, "Title", 160);
  const description = reqText(body.description, "Description");
  const { siteId, departmentId } = sharedPlace(db, body);
  const reportedBy = reqId(body.reportedBy, "Reported by");
  person(db, reportedBy, "Reported by");
  const occurredAt = reqDate(body.occurredAt, "Occurrence date", { notFuture: true });
  const incidentType = reqEnum(body.incidentType, ENUMS.incidentType, "Incident type");
  const severity = reqEnum(body.severity, ENUMS.incidentSeverity, "Severity");
  const daysLost = Number(body.daysLost ?? 0);
  if (!Number.isInteger(daysLost) || daysLost < 0 || daysLost > 3650) {
    throw new HttpError(400, "Days lost must be a whole number");
  }
  const status = body.status === "draft" ? "draft" : "reported";
  const now = nowIso();
  const id = withTx(db, () => {
    const newId = insertRow(db, "incidents", {
      reference: nextReference(db, "incidents", "INC"),
      title,
      description,
      site_id: siteId,
      department_id: departmentId,
      reported_by: reportedBy,
      occurred_at: occurredAt,
      location_detail: optText(body.locationDetail, "Location", 200),
      incident_type: incidentType,
      severity,
      injured_name: optText(body.injuredName, "Injured person", 160),
      body_part: optText(body.bodyPart, "Body part", 120),
      days_lost: daysLost,
      immediate_action: optText(body.immediateAction, "Immediate action"),
      root_cause: optText(body.rootCause, "Root cause"),
      status,
      created_at: now,
      updated_at: now,
    });
    addEvent(db, "incident", newId, null, status, reportedBy, "Record created", now);
    return newId;
  });
  return getIncident(db, id);
}

export function updateIncidentCause(db, id, body) {
  const current = getIncident(db, id);
  if (!current) throw new HttpError(404, "Record not found");
  const rootCause = reqText(body.rootCause, "Root cause");
  const actorId = reqId(body.actorId, "Updated by");
  person(db, actorId, "Updated by");
  const now = nowIso();
  withTx(db, () => {
    db.prepare("UPDATE incidents SET root_cause = ?, updated_at = ? WHERE id = ?").run(rootCause, now, id);
    addEvent(db, "incident", id, current.status, current.status, actorId, "Root cause updated", now);
  });
  return getIncident(db, id);
}

export function createAudit(db, body) {
  const title = reqText(body.title, "Title", 160);
  const { siteId, departmentId } = sharedPlace(db, body);
  const leadAuditor = reqId(body.leadAuditor, "Lead auditor");
  person(db, leadAuditor, "Lead auditor");
  const scheduledDate = reqDate(body.scheduledDate, "Scheduled date");
  const auditType = reqEnum(body.auditType, ENUMS.auditType, "Audit type");
  const now = nowIso();
  const id = withTx(db, () => {
    const newId = insertRow(db, "audits", {
      reference: nextReference(db, "audits", "AUD"),
      title,
      audit_type: auditType,
      site_id: siteId,
      department_id: departmentId,
      lead_auditor: leadAuditor,
      scheduled_date: scheduledDate,
      completed_date: null,
      scope: optText(body.scope, "Scope"),
      score: null,
      status: "planned",
      created_at: now,
      updated_at: now,
    });
    addEvent(db, "audit", newId, null, "planned", leadAuditor, "Audit planned", now);
    return newId;
  });
  return getAudit(db, id);
}

export function createFinding(db, auditId, body) {
  const audit = getAudit(db, auditId);
  if (!audit) throw new HttpError(404, "Audit not found");
  if (!["in_progress", "findings_open"].includes(audit.status)) {
    throw new HttpError(400, "Findings can be added while the audit is in progress or has open findings");
  }
  const description = reqText(body.description, "Finding");
  const severity = reqEnum(body.severity, ENUMS.findingSeverity, "Severity");
  const ownerId = reqId(body.ownerId, "Owner");
  person(db, ownerId, "Owner");
  const dueDate = reqDate(body.dueDate, "Due date");
  const now = nowIso();
  const id = withTx(db, () => {
    const newId = insertRow(db, "findings", {
      reference: nextReference(db, "findings", "FND"),
      audit_id: auditId,
      description,
      severity,
      status: "open",
      owner_id: ownerId,
      due_date: dueDate,
      site_id: audit.siteId,
      department_id: audit.departmentId,
      created_at: now,
      updated_at: now,
    });
    addEvent(db, "finding", newId, null, "open", ownerId, `Raised on ${audit.reference}`, now);
    return newId;
  });
  return getFinding(db, id);
}

export function createPermit(db, body) {
  const title = reqText(body.title, "Title", 160);
  const { siteId, departmentId } = sharedPlace(db, body);
  const requesterId = reqId(body.requesterId, "Requester");
  person(db, requesterId, "Requester");
  const issuerId = optId(body.issuerId, "Issuer");
  if (issuerId) person(db, issuerId, "Issuer");
  const permitType = reqEnum(body.permitType, ENUMS.permitType, "Permit type");
  const validFrom = reqDate(body.validFrom, "Valid from");
  const validTo = reqDate(body.validTo, "Valid to");
  if (validTo < validFrom) throw new HttpError(400, "Valid to cannot be before valid from");
  const status = body.status === "requested" ? "requested" : "draft";
  if (status === "requested" && !issuerId) throw new HttpError(400, "Choose the permit authority before requesting approval");
  const now = nowIso();
  const id = withTx(db, () => {
    const newId = insertRow(db, "permits", {
      reference: nextReference(db, "permits", "PTW"),
      title,
      permit_type: permitType,
      site_id: siteId,
      department_id: departmentId,
      requester_id: requesterId,
      issuer_id: issuerId,
      location_detail: optText(body.locationDetail, "Location", 200),
      work_description: reqText(body.workDescription, "Work description"),
      hazards: optText(body.hazards, "Hazards"),
      controls: optText(body.controls, "Controls"),
      valid_from: validFrom,
      valid_to: validTo,
      status,
      created_at: now,
      updated_at: now,
    });
    addEvent(db, "permit", newId, null, status, requesterId, "Permit drafted", now);
    return newId;
  });
  return getPermit(db, id);
}

function readSteps(body) {
  if (!Array.isArray(body.steps) || body.steps.length < 1) throw new HttpError(400, "Add at least one job step");
  if (body.steps.length > 20) throw new HttpError(400, "A JSA can have at most 20 steps");
  return body.steps.map((step, index) => ({
    step_no: index + 1,
    task_step: reqText(step.taskStep, `Step ${index + 1} task`, 500),
    hazard: reqText(step.hazard, `Step ${index + 1} hazard`, 500),
    controls: reqText(step.controls, `Step ${index + 1} controls`, 500),
    risk_before: reqEnum(step.riskBefore, ENUMS.jsaRisk, `Step ${index + 1} risk before`),
    risk_after: reqEnum(step.riskAfter, ENUMS.jsaRisk, `Step ${index + 1} risk after`),
  }));
}

export function createJsa(db, body) {
  const jobTitle = reqText(body.jobTitle, "Job title", 160);
  const { siteId, departmentId } = sharedPlace(db, body);
  const preparedBy = reqId(body.preparedBy, "Prepared by");
  person(db, preparedBy, "Prepared by");
  const validUntil = reqDate(body.validUntil, "Valid until");
  const steps = readSteps(body);
  const now = nowIso();
  const id = withTx(db, () => {
    const newId = insertRow(db, "jsas", {
      reference: nextReference(db, "jsas", "JSA"),
      job_title: jobTitle,
      site_id: siteId,
      department_id: departmentId,
      prepared_by: preparedBy,
      reviewed_by: null,
      task_description: reqText(body.taskDescription, "Task description"),
      ppe: optText(body.ppe, "PPE"),
      status: "draft",
      valid_until: validUntil,
      created_at: now,
      updated_at: now,
    });
    for (const step of steps) insertRow(db, "jsa_steps", { jsa_id: newId, ...step });
    addEvent(db, "jsa", newId, null, "draft", preparedBy, "JSA drafted", now);
    return newId;
  });
  return getJsa(db, id);
}

function readHazards(body) {
  if (!Array.isArray(body.hazards) || body.hazards.length < 1) throw new HttpError(400, "Add at least one hazard");
  if (body.hazards.length > 20) throw new HttpError(400, "A risk assessment can have at most 20 hazards");
  return body.hazards.map((hazard, index) => ({
    hazard: reqText(hazard.hazard, `Hazard ${index + 1}`, 300),
    consequence: optText(hazard.consequence, `Consequence ${index + 1}`, 300),
    likelihood: reqScore(hazard.likelihood, `Likelihood ${index + 1}`),
    severity: reqScore(hazard.severity, `Severity ${index + 1}`),
    controls: optText(hazard.controls, `Controls ${index + 1}`),
    residual_likelihood: reqScore(hazard.residualLikelihood, `Residual likelihood ${index + 1}`),
    residual_severity: reqScore(hazard.residualSeverity, `Residual severity ${index + 1}`),
  }));
}

export function createRisk(db, body) {
  const title = reqText(body.title, "Title", 160);
  const { siteId, departmentId } = sharedPlace(db, body);
  const assessorId = reqId(body.assessorId, "Assessor");
  person(db, assessorId, "Assessor");
  const reviewDate = reqDate(body.reviewDate, "Review date");
  const hazards = readHazards(body);
  const now = nowIso();
  const id = withTx(db, () => {
    const newId = insertRow(db, "risk_assessments", {
      reference: nextReference(db, "risk_assessments", "RA"),
      title,
      site_id: siteId,
      department_id: departmentId,
      assessor_id: assessorId,
      activity: reqText(body.activity, "Activity"),
      status: "draft",
      review_date: reviewDate,
      created_at: now,
      updated_at: now,
    });
    for (const hazard of hazards) insertRow(db, "risk_hazards", { risk_id: newId, ...hazard });
    addEvent(db, "risk", newId, null, "draft", assessorId, "Assessment drafted", now);
    return newId;
  });
  return getRisk(db, id);
}

export function createAction(db, body) {
  const sourceType = reqEnum(
    body.sourceType,
    [
      ["near_miss", "Near miss"],
      ["incident", "Incident"],
      ["audit", "Audit"],
      ["finding", "Finding"],
      ["permit", "Permit"],
      ["jsa", "JSA"],
      ["risk", "Risk"],
    ],
    "Source",
  );
  const sourceId = reqId(body.sourceId, "Source record");
  const getters = {
    near_miss: getNearMiss,
    incident: getIncident,
    audit: getAudit,
    finding: getFinding,
    permit: getPermit,
    jsa: getJsa,
    risk: getRisk,
  };
  const source = getters[sourceType](db, sourceId);
  if (!source) throw new HttpError(400, "Source record was not found");
  const ownerId = reqId(body.ownerId, "Owner");
  person(db, ownerId, "Owner");
  const dueDate = reqDate(body.dueDate, "Due date");
  const title = reqText(body.title, "Action", 200);
  const now = nowIso();
  const id = withTx(db, () => {
    const newId = insertRow(db, "actions", {
      reference: nextReference(db, "actions", "ACT"),
      source_type: sourceType,
      source_id: sourceId,
      source_reference: source.reference,
      title,
      owner_id: ownerId,
      due_date: dueDate,
      status: "open",
      site_id: source.siteId,
      department_id: source.departmentId,
      created_at: now,
      updated_at: now,
    });
    addEvent(db, "action", newId, null, "open", ownerId, `Opened from ${source.reference}`, now);
    return newId;
  });
  return getAction(db, id);
}

const GETTERS = {
  near_miss: getNearMiss,
  incident: getIncident,
  audit: getAudit,
  finding: getFinding,
  permit: getPermit,
  jsa: getJsa,
  risk: getRisk,
  action: getAction,
};

const TABLES = {
  near_miss: "near_misses",
  incident: "incidents",
  audit: "audits",
  finding: "findings",
  permit: "permits",
  jsa: "jsas",
  risk: "risk_assessments",
  action: "actions",
};

export function transition(db, entity, id, body) {
  const getter = GETTERS[entity];
  if (!getter) throw new HttpError(400, "Unknown record");
  const current = getter(db, id);
  if (!current) throw new HttpError(404, "Record not found");
  const status = String(body.status || "");
  const allowed = TRANSITIONS[entity][current.status] || [];
  if (!allowed.includes(status)) {
    throw new HttpError(
      400,
      `Cannot move from ${STATUS_LABELS[current.status] || current.status} to ${STATUS_LABELS[status] || status || "that status"}`,
    );
  }
  const actorId = reqId(body.actorId, "Updated by");
  person(db, actorId, "Updated by");
  const note = optText(body.note, "Note", 1000);
  const now = nowIso();
  withTx(db, () => {
    db.prepare(`UPDATE ${TABLES[entity]} SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, id);
    if (entity === "audit" && status === "closed") {
      db.prepare("UPDATE audits SET completed_date = COALESCE(completed_date, ?) WHERE id = ?").run(today(), id);
    }
    if (entity === "jsa" && status === "approved") {
      const reviewer = optId(body.reviewerId, "Reviewer") || actorId;
      person(db, reviewer, "Reviewer");
      db.prepare("UPDATE jsas SET reviewed_by = ? WHERE id = ?").run(reviewer, id);
    }
    addEvent(db, entity, id, current.status, status, actorId, note, now);
  });
  return getter(db, id);
}
