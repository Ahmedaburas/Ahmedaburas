import { addDays, riyadhToday } from './dates.js';
import { nextRef, withTx } from './db.js';
import { ltifr, riskBand, riskScore, trir } from './kpi.js';
import {
  ACTION_STATUSES,
  COURSES,
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
  INSPECTION_TEMPLATES,
  LOCATIONS,
  OBSERVATION_CATEGORIES,
  OBSERVATION_KINDS,
  PERMIT_STATUSES,
  PERMIT_TRANSITIONS,
  PERMIT_TYPES,
  PRIORITIES,
  RISK_STATUSES,
  SEVERITIES,
} from './templates.js';
import {
  bool,
  dateOnly,
  heatIndex,
  hoursWorked,
  oneOf,
  optionalString,
  requiredString,
  score,
  yardTime,
  badRequest,
} from './validate.js';

const HEAT_THRESHOLD_KEY = 'heat_threshold_c';
const HOURS_KEY = 'hours_worked';

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}

function incidentDto(row) {
  return {
    id: row.id,
    ref: row.ref,
    type: row.type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    location: row.location,
    occurredAt: row.occurred_at,
    reportedBy: row.reported_by,
    status: row.status,
    recordable: row.recordable === 1,
    lti: row.lti === 1,
    immediateAction: row.immediate_action,
    investigation: row.investigation,
  };
}

function observationDto(row) {
  return {
    id: row.id,
    ref: row.ref,
    kind: row.kind,
    category: row.category,
    description: row.description,
    location: row.location,
    observedAt: row.observed_at,
    observer: row.observer,
  };
}

function hazardDto(row) {
  const initial = riskScore(row.likelihood, row.severity);
  const residual = riskScore(row.residual_likelihood, row.residual_severity);
  return {
    id: row.id,
    hazard: row.hazard,
    consequence: row.consequence,
    likelihood: row.likelihood,
    severity: row.severity,
    score: initial,
    band: riskBand(initial),
    controls: row.controls,
    residualLikelihood: row.residual_likelihood,
    residualSeverity: row.residual_severity,
    residualScore: residual,
    residualBand: riskBand(residual),
  };
}

function riskDto(row, hazards) {
  const worst = hazards.reduce((max, hazard) => Math.max(max, hazard.residualScore), 0);
  return {
    id: row.id,
    ref: row.ref,
    task: row.task,
    area: row.area,
    assessor: row.assessor,
    assessedOn: row.assessed_on,
    status: row.status,
    hazards,
    residualBand: hazards.length ? riskBand(worst) : 'low',
  };
}

function permitDto(row, today) {
  const live = row.status === 'issued' || row.status === 'active';
  return {
    id: row.id,
    ref: row.ref,
    type: row.type,
    location: row.location,
    description: row.description,
    issuer: row.issuer,
    acceptor: row.acceptor,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    status: row.status,
    controls: row.controls,
    expiring: live && row.valid_to <= addDays(today, 1),
  };
}

function inspectionDto(row, items) {
  return {
    id: row.id,
    ref: row.ref,
    template: row.template,
    templateTitle: INSPECTION_TEMPLATES[row.template]?.title ?? row.template,
    area: row.area,
    inspector: row.inspector,
    inspectedOn: row.inspected_on,
    status: row.status,
    items,
  };
}

function actionDto(row, today) {
  const overdue = row.status !== 'closed' && row.due_on < today;
  return {
    id: row.id,
    ref: row.ref,
    title: row.title,
    source: row.source,
    owner: row.owner,
    dueOn: row.due_on,
    status: row.status,
    priority: row.priority,
    note: row.note,
    overdue,
  };
}

function trainingDto(row, today) {
  return {
    id: row.id,
    person: row.person,
    course: row.course,
    completedOn: row.completed_on,
    expiresOn: row.expires_on,
    expired: row.expires_on < today,
  };
}

function heatDto(row, threshold) {
  return {
    id: row.id,
    recordedAt: row.recorded_at,
    location: row.location,
    heatIndexC: row.heat_index_c,
    alert: row.heat_index_c >= threshold,
  };
}

function like(value) {
  return `%${String(value).replace(/[\\%_]/g, '')}%`;
}

export function listPeople(db) {
  return db.prepare('SELECT id, name, role, department FROM people ORDER BY name').all();
}

export function getHours(db) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(HOURS_KEY);
  return Number(row?.value ?? 0);
}

export function getThreshold(db) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(HEAT_THRESHOLD_KEY);
  return Number(row?.value ?? 42);
}

export function updateHours(db, input) {
  const hours = hoursWorked(input?.hoursWorked);
  db.prepare(
    `INSERT INTO settings(key, value) VALUES(?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(HOURS_KEY, String(hours));
  return { hoursWorked: hours, ...rates(db, hours) };
}

function rates(db, hours) {
  const counts = db.prepare(
    `SELECT
       COALESCE(SUM(recordable), 0) AS recordable,
       COALESCE(SUM(lti), 0) AS lti
     FROM incidents`,
  ).get();
  return {
    trir: trir(counts.recordable, hours),
    ltifr: ltifr(counts.lti, hours),
    recordable: counts.recordable,
    lti: counts.lti,
  };
}

export function listIncidents(db, query = {}) {
  const where = [];
  const params = [];
  if (query.status) {
    where.push('status = ?');
    params.push(oneOf(query.status, 'status', INCIDENT_STATUSES));
  }
  if (query.type) {
    where.push('type = ?');
    params.push(oneOf(query.type, 'type', INCIDENT_TYPES));
  }
  if (query.q) {
    where.push('(title LIKE ? OR ref LIKE ? OR location LIKE ?)');
    const pattern = like(query.q);
    params.push(pattern, pattern, pattern);
  }
  const sql = `SELECT * FROM incidents ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY occurred_at DESC, id DESC`;
  return db.prepare(sql).all(...params).map(incidentDto);
}

export function getIncident(db, id) {
  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
  if (!row) return null;
  const actions = db.prepare('SELECT * FROM actions WHERE source = ? ORDER BY due_on').all(row.ref);
  const today = riyadhToday();
  return { ...incidentDto(row), actions: actions.map((action) => actionDto(action, today)) };
}

function classifyInjury(type, recordable, lti) {
  if (type !== 'injury') return { recordable: 0, lti: 0 };
  const lostTime = bool(lti);
  const isRecordable = lostTime || bool(recordable);
  return { recordable: isRecordable ? 1 : 0, lti: lostTime ? 1 : 0 };
}

export function createIncident(db, input) {
  const type = oneOf(input?.type, 'type', INCIDENT_TYPES);
  const flags = classifyInjury(type, input?.recordable, input?.lti);
  const row = {
    type,
    severity: oneOf(input?.severity, 'severity', SEVERITIES),
    title: requiredString(input?.title, 'title', 160),
    description: requiredString(input?.description, 'description', 4000),
    location: requiredString(input?.location, 'location', 120),
    occurredAt: yardTime(input?.occurredAt, 'occurredAt'),
    reportedBy: requiredString(input?.reportedBy, 'reportedBy', 120),
    immediateAction: optionalString(input?.immediateAction, 'immediateAction', 2000),
    ...flags,
  };
  return withTx(db, () => {
    const ref = nextRef(db, 'INC');
    const info = db.prepare(
      `INSERT INTO incidents
        (ref, type, severity, title, description, location, occurred_at, reported_by, status, recordable, lti, immediate_action, investigation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'reported', ?, ?, ?, '')`,
    ).run(
      ref,
      row.type,
      row.severity,
      row.title,
      row.description,
      row.location,
      row.occurredAt,
      row.reportedBy,
      row.recordable,
      row.lti,
      row.immediateAction,
    );
    return getIncident(db, Number(info.lastInsertRowid));
  });
}

export function patchIncident(db, id, input) {
  const current = getIncident(db, id);
  if (!current) throw notFound('Incident not found');
  const status = input?.status == null ? current.status : oneOf(input.status, 'status', INCIDENT_STATUSES);
  const investigation = input?.investigation == null
    ? current.investigation
    : optionalString(input.investigation, 'investigation', 4000);
  const immediateAction = input?.immediateAction == null
    ? current.immediateAction
    : optionalString(input.immediateAction, 'immediateAction', 2000);
  const type = input?.type == null ? current.type : oneOf(input.type, 'type', INCIDENT_TYPES);
  const severity = input?.severity == null ? current.severity : oneOf(input.severity, 'severity', SEVERITIES);
  const flags = classifyInjury(
    type,
    input?.recordable == null ? current.recordable : input.recordable,
    input?.lti == null ? current.lti : input.lti,
  );
  if (status === 'closed' && !investigation.trim()) {
    throw badRequest('An investigation note is required before closing an incident');
  }
  db.prepare(
    `UPDATE incidents
     SET status = ?, investigation = ?, immediate_action = ?, type = ?, severity = ?, recordable = ?, lti = ?
     WHERE id = ?`,
  ).run(status, investigation, immediateAction, type, severity, flags.recordable, flags.lti, id);
  return getIncident(db, id);
}

export function listObservations(db, query = {}) {
  const where = [];
  const params = [];
  if (query.kind) {
    where.push('kind = ?');
    params.push(oneOf(query.kind, 'kind', OBSERVATION_KINDS));
  }
  if (query.category) {
    where.push('category = ?');
    params.push(oneOf(query.category, 'category', OBSERVATION_CATEGORIES));
  }
  const sql = `SELECT * FROM observations ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY observed_at DESC, id DESC`;
  return db.prepare(sql).all(...params).map(observationDto);
}

export function createObservation(db, input) {
  const row = {
    kind: oneOf(input?.kind, 'kind', OBSERVATION_KINDS),
    category: oneOf(input?.category, 'category', OBSERVATION_CATEGORIES),
    description: requiredString(input?.description, 'description', 2000),
    location: requiredString(input?.location, 'location', 120),
    observedAt: yardTime(input?.observedAt, 'observedAt'),
    observer: requiredString(input?.observer, 'observer', 120),
  };
  return withTx(db, () => {
    const ref = nextRef(db, 'OBS');
    const info = db.prepare(
      `INSERT INTO observations (ref, kind, category, description, location, observed_at, observer)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(ref, row.kind, row.category, row.description, row.location, row.observedAt, row.observer);
    const saved = db.prepare('SELECT * FROM observations WHERE id = ?').get(Number(info.lastInsertRowid));
    return observationDto(saved);
  });
}

function loadHazards(db, assessmentId) {
  return db.prepare('SELECT * FROM risk_hazards WHERE assessment_id = ? ORDER BY id').all(assessmentId).map(hazardDto);
}

export function listRisks(db) {
  const rows = db.prepare('SELECT * FROM risk_assessments ORDER BY assessed_on DESC, id DESC').all();
  return rows.map((row) => riskDto(row, loadHazards(db, row.id)));
}

export function getRisk(db, id) {
  const row = db.prepare('SELECT * FROM risk_assessments WHERE id = ?').get(id);
  if (!row) return null;
  return riskDto(row, loadHazards(db, id));
}

function readHazards(input) {
  if (!Array.isArray(input) || input.length === 0) throw badRequest('At least one hazard is required');
  if (input.length > 12) throw badRequest('A risk assessment can hold at most 12 hazards');
  return input.map((hazard) => ({
    hazard: requiredString(hazard?.hazard, 'hazard', 200),
    consequence: requiredString(hazard?.consequence, 'consequence', 200),
    likelihood: score(hazard?.likelihood, 'likelihood'),
    severity: score(hazard?.severity, 'severity'),
    controls: requiredString(hazard?.controls, 'controls', 1000),
    residualLikelihood: score(hazard?.residualLikelihood, 'residualLikelihood'),
    residualSeverity: score(hazard?.residualSeverity, 'residualSeverity'),
  }));
}

export function createRisk(db, input) {
  const task = requiredString(input?.task, 'task', 200);
  const area = requiredString(input?.area, 'area', 120);
  const assessor = requiredString(input?.assessor, 'assessor', 120);
  const assessedOn = dateOnly(input?.assessedOn, 'assessedOn');
  const status = input?.status == null ? 'draft' : oneOf(input.status, 'status', RISK_STATUSES);
  const hazards = readHazards(input?.hazards);
  return withTx(db, () => {
    const ref = nextRef(db, 'RA');
    const info = db.prepare(
      `INSERT INTO risk_assessments (ref, task, area, assessor, assessed_on, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(ref, task, area, assessor, assessedOn, status);
    const id = Number(info.lastInsertRowid);
    const insert = db.prepare(
      `INSERT INTO risk_hazards
        (assessment_id, hazard, consequence, likelihood, severity, controls, residual_likelihood, residual_severity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const hazard of hazards) {
      insert.run(
        id,
        hazard.hazard,
        hazard.consequence,
        hazard.likelihood,
        hazard.severity,
        hazard.controls,
        hazard.residualLikelihood,
        hazard.residualSeverity,
      );
    }
    return getRisk(db, id);
  });
}

export function patchRisk(db, id, input) {
  const current = getRisk(db, id);
  if (!current) throw notFound('Risk assessment not found');
  const status = oneOf(input?.status, 'status', RISK_STATUSES);
  db.prepare('UPDATE risk_assessments SET status = ? WHERE id = ?').run(status, id);
  return getRisk(db, id);
}

export function listPermits(db, query = {}) {
  const today = riyadhToday();
  const where = [];
  const params = [];
  if (query.status) {
    where.push('status = ?');
    params.push(oneOf(query.status, 'status', PERMIT_STATUSES));
  }
  if (query.type) {
    where.push('type = ?');
    params.push(oneOf(query.type, 'type', PERMIT_TYPES));
  }
  const sql = `SELECT * FROM permits ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY valid_from DESC, id DESC`;
  return db.prepare(sql).all(...params).map((row) => permitDto(row, today));
}

export function getPermit(db, id) {
  const row = db.prepare('SELECT * FROM permits WHERE id = ?').get(id);
  if (!row) return null;
  return permitDto(row, riyadhToday());
}

export function createPermit(db, input) {
  const validFrom = dateOnly(input?.validFrom, 'validFrom');
  const validTo = dateOnly(input?.validTo, 'validTo');
  if (validTo < validFrom) throw badRequest('validTo cannot be before validFrom');
  const row = {
    type: oneOf(input?.type, 'type', PERMIT_TYPES),
    location: requiredString(input?.location, 'location', 120),
    description: requiredString(input?.description, 'description', 2000),
    issuer: requiredString(input?.issuer, 'issuer', 120),
    acceptor: requiredString(input?.acceptor, 'acceptor', 120),
    validFrom,
    validTo,
    controls: requiredString(input?.controls, 'controls', 2000),
  };
  return withTx(db, () => {
    const ref = nextRef(db, 'PTW');
    const info = db.prepare(
      `INSERT INTO permits
        (ref, type, location, description, issuer, acceptor, valid_from, valid_to, status, controls)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?)`,
    ).run(ref, row.type, row.location, row.description, row.issuer, row.acceptor, row.validFrom, row.validTo, row.controls);
    return getPermit(db, Number(info.lastInsertRowid));
  });
}

export function patchPermit(db, id, input) {
  const current = getPermit(db, id);
  if (!current) throw notFound('Permit not found');
  const status = oneOf(input?.status, 'status', PERMIT_STATUSES);
  const allowed = PERMIT_TRANSITIONS[current.status];
  if (!allowed.includes(status)) {
    throw badRequest(`Cannot move a permit from ${current.status} to ${status}`);
  }
  db.prepare('UPDATE permits SET status = ? WHERE id = ?').run(status, id);
  return getPermit(db, id);
}

export function listInspections(db) {
  const rows = db.prepare('SELECT * FROM inspections ORDER BY inspected_on DESC, id DESC').all();
  return rows.map((row) => inspectionDto(row, loadInspectionItems(db, row.id)));
}

function loadInspectionItems(db, inspectionId) {
  return db.prepare('SELECT id, label, result, note FROM inspection_items WHERE inspection_id = ? ORDER BY id').all(inspectionId);
}

export function getInspection(db, id) {
  const row = db.prepare('SELECT * FROM inspections WHERE id = ?').get(id);
  if (!row) return null;
  return inspectionDto(row, loadInspectionItems(db, id));
}

export function createInspection(db, input) {
  const template = oneOf(input?.template, 'template', Object.keys(INSPECTION_TEMPLATES));
  const expected = INSPECTION_TEMPLATES[template].items;
  if (!Array.isArray(input?.items) || input.items.length !== expected.length) {
    throw badRequest('Inspection items must match the template');
  }
  const items = input.items.map((item, index) => {
    const label = requiredString(item?.label, 'label', 200);
    if (label !== expected[index]) throw badRequest('Inspection items must match the template');
    const result = oneOf(item?.result, 'result', ['pass', 'fail', 'na']);
    return { label, result, note: optionalString(item?.note, 'note', 500) };
  });
  const area = requiredString(input?.area, 'area', 120);
  const inspector = requiredString(input?.inspector, 'inspector', 120);
  const inspectedOn = dateOnly(input?.inspectedOn, 'inspectedOn');
  const status = items.some((item) => item.result === 'fail') ? 'actions_required' : 'satisfactory';
  return withTx(db, () => {
    const ref = nextRef(db, 'INS');
    const info = db.prepare(
      `INSERT INTO inspections (ref, template, area, inspector, inspected_on, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(ref, template, area, inspector, inspectedOn, status);
    const id = Number(info.lastInsertRowid);
    const insert = db.prepare(
      'INSERT INTO inspection_items (inspection_id, label, result, note) VALUES (?, ?, ?, ?)',
    );
    for (const item of items) insert.run(id, item.label, item.result, item.note);
    return getInspection(db, id);
  });
}

export function listActions(db, query = {}) {
  const today = riyadhToday();
  const rows = db.prepare('SELECT * FROM actions ORDER BY due_on, id').all();
  let items = rows.map((row) => actionDto(row, today));
  if (query.status === 'overdue') items = items.filter((item) => item.overdue);
  else if (query.status) {
    const status = oneOf(query.status, 'status', ACTION_STATUSES);
    items = items.filter((item) => item.status === status);
  }
  if (query.priority) {
    const priority = oneOf(query.priority, 'priority', PRIORITIES);
    items = items.filter((item) => item.priority === priority);
  }
  return items;
}

export function createAction(db, input) {
  const row = {
    title: requiredString(input?.title, 'title', 200),
    source: requiredString(input?.source, 'source', 80),
    owner: requiredString(input?.owner, 'owner', 120),
    dueOn: dateOnly(input?.dueOn, 'dueOn'),
    priority: oneOf(input?.priority, 'priority', PRIORITIES),
    note: optionalString(input?.note, 'note', 2000),
  };
  return withTx(db, () => {
    const ref = nextRef(db, 'ACT');
    const info = db.prepare(
      `INSERT INTO actions (ref, title, source, owner, due_on, status, priority, note)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
    ).run(ref, row.title, row.source, row.owner, row.dueOn, row.priority, row.note);
    const saved = db.prepare('SELECT * FROM actions WHERE id = ?').get(Number(info.lastInsertRowid));
    return actionDto(saved, riyadhToday());
  });
}

export function patchAction(db, id, input) {
  const row = db.prepare('SELECT * FROM actions WHERE id = ?').get(id);
  if (!row) throw notFound('Action not found');
  const status = oneOf(input?.status, 'status', ACTION_STATUSES);
  const note = input?.note == null ? row.note : optionalString(input.note, 'note', 2000);
  db.prepare('UPDATE actions SET status = ?, note = ? WHERE id = ?').run(status, note, id);
  const saved = db.prepare('SELECT * FROM actions WHERE id = ?').get(id);
  return actionDto(saved, riyadhToday());
}

export function listTraining(db) {
  const today = riyadhToday();
  return db.prepare('SELECT * FROM training ORDER BY expires_on, person').all().map((row) => trainingDto(row, today));
}

export function createTraining(db, input) {
  const completedOn = dateOnly(input?.completedOn, 'completedOn');
  const expiresOn = dateOnly(input?.expiresOn, 'expiresOn');
  if (expiresOn < completedOn) throw badRequest('expiresOn cannot be before completedOn');
  const person = requiredString(input?.person, 'person', 120);
  const course = oneOf(input?.course, 'course', COURSES);
  const info = db.prepare(
    'INSERT INTO training (person, course, completed_on, expires_on) VALUES (?, ?, ?, ?)',
  ).run(person, course, completedOn, expiresOn);
  const saved = db.prepare('SELECT * FROM training WHERE id = ?').get(Number(info.lastInsertRowid));
  return trainingDto(saved, riyadhToday());
}

export function listHeat(db) {
  const threshold = getThreshold(db);
  const items = db.prepare('SELECT * FROM heat_readings ORDER BY recorded_at DESC, id DESC LIMIT 48').all()
    .map((row) => heatDto(row, threshold));
  const latest = items[0] ?? null;
  return {
    threshold,
    latest,
    alert: Boolean(latest?.alert),
    items,
  };
}

export function createHeat(db, input) {
  const reading = {
    location: requiredString(input?.location, 'location', 120),
    heatIndexC: heatIndex(input?.heatIndexC),
    recordedAt: yardTime(input?.recordedAt, 'recordedAt'),
  };
  const info = db.prepare(
    'INSERT INTO heat_readings (recorded_at, location, heat_index_c) VALUES (?, ?, ?)',
  ).run(reading.recordedAt, reading.location, reading.heatIndexC);
  const saved = db.prepare('SELECT * FROM heat_readings WHERE id = ?').get(Number(info.lastInsertRowid));
  return heatDto(saved, getThreshold(db));
}

export function getDashboard(db) {
  const today = riyadhToday();
  const hours = getHours(db);
  const rate = rates(db, hours);
  const incidents = db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'near_miss' THEN 1 ELSE 0 END), 0) AS near_miss,
       COALESCE(SUM(CASE WHEN status != 'closed' THEN 1 ELSE 0 END), 0) AS open_incidents
     FROM incidents`,
  ).get();
  const actions = listActions(db);
  const openActions = actions.filter((action) => action.status !== 'closed');
  const permits = listPermits(db);
  const training = listTraining(db);
  const heat = listHeat(db);
  const observations = db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN kind = 'safe' THEN 1 ELSE 0 END), 0) AS safe,
       COALESCE(SUM(CASE WHEN kind = 'at_risk' THEN 1 ELSE 0 END), 0) AS at_risk
     FROM observations`,
  ).get();
  const recent = db.prepare('SELECT * FROM incidents ORDER BY occurred_at DESC, id DESC LIMIT 5').all().map(incidentDto);
  const attention = [];
  for (const action of openActions.filter((item) => item.overdue)) {
    attention.push({ tone: 'bad', kind: 'Action', title: `${action.ref} overdue · ${action.title}`, href: '#/actions' });
  }
  for (const permit of permits.filter((item) => item.expiring)) {
    attention.push({ tone: 'warn', kind: 'Permit', title: `${permit.ref} expires ${permit.validTo}`, href: `#/permits/${permit.id}` });
  }
  for (const record of training.filter((item) => item.expired)) {
    attention.push({ tone: 'warn', kind: 'Training', title: `${record.person} · ${record.course} expired`, href: '#/training' });
  }
  for (const incident of recent.filter((item) => item.status !== 'closed' && (item.severity === 'high' || item.severity === 'critical'))) {
    attention.push({ tone: 'bad', kind: 'Incident', title: `${incident.ref} ${incident.title}`, href: `#/incidents/${incident.id}` });
  }
  return {
    today,
    timezone: 'Asia/Riyadh',
    hoursWorked: hours,
    trir: rate.trir,
    ltifr: rate.ltifr,
    recordable: rate.recordable,
    lti: rate.lti,
    nearMiss: incidents.near_miss,
    openIncidents: incidents.open_incidents,
    openActions: openActions.length,
    overdueActions: openActions.filter((action) => action.overdue).length,
    activePermits: permits.filter((permit) => permit.status === 'issued' || permit.status === 'active').length,
    safeObservations: observations.safe,
    atRiskObservations: observations.at_risk,
    expiredTraining: training.filter((item) => item.expired).length,
    heat,
    recent,
    attention: attention.slice(0, 8),
    months: monthTrend(db, today),
  };
}

function monthTrend(db, today) {
  const incidents = db.prepare('SELECT occurred_at FROM incidents').all();
  const observations = db.prepare('SELECT observed_at FROM observations').all();
  const months = [];
  const [year, month] = today.split('-').map(Number);
  for (let offset = 5; offset >= 0; offset -= 1) {
    const cursor = new Date(Date.UTC(year, month - 1 - offset, 1));
    const key = cursor.toISOString().slice(0, 7);
    months.push({
      month: key,
      incidents: incidents.filter((row) => String(row.occurred_at).slice(0, 7) === key).length,
      observations: observations.filter((row) => String(row.observed_at).slice(0, 7) === key).length,
    });
  }
  return months;
}

export function meta(db) {
  return {
    people: listPeople(db),
    locations: LOCATIONS,
    templates: INSPECTION_TEMPLATES,
    courses: COURSES,
    threshold: getThreshold(db),
  };
}
