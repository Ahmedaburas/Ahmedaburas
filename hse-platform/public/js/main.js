import { api } from './api.js';
import { esc, fmtDay, fmtMonth, fmtNum, fmtWhen, label, nowInput, todayInput, yardClock } from './format.js';

const NAV = [
  ['#/', 'Yard board', '/'],
  ['#/incidents', 'Incidents', '/incidents'],
  ['#/observations', 'Observations', '/observations'],
  ['#/risks', 'Risk assessments', '/risks'],
  ['#/permits', 'Permits', '/permits'],
  ['#/inspections', 'Inspections', '/inspections'],
  ['#/actions', 'Actions', '/actions'],
  ['#/training', 'Training', '/training'],
  ['#/heat', 'Heat stress', '/heat'],
];

const PERMIT_NEXT = {
  requested: [['issued', 'Issue permit'], ['rejected', 'Reject']],
  issued: [['active', 'Mark active'], ['suspended', 'Suspend'], ['closed', 'Close permit']],
  active: [['suspended', 'Suspend'], ['closed', 'Close permit']],
  suspended: [['active', 'Resume'], ['closed', 'Close permit']],
};

const INCIDENT_STATUSES = ['reported', 'investigating', 'actions_open', 'closed'];
const INCIDENT_TYPES = ['injury', 'near_miss', 'property', 'environmental', 'fire'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const OBSERVATION_KINDS = ['safe', 'at_risk'];
const OBSERVATION_CATEGORIES = ['ppe', 'housekeeping', 'lifting', 'hot_work', 'line_of_fire', 'environment', 'tools'];
const PERMIT_TYPES = ['hot_work', 'work_at_height', 'confined_space', 'lifting', 'excavation', 'electrical_isolation'];
const PRIORITIES = ['low', 'medium', 'high'];

let flash = null;
let metaPromise = null;
let metaData = null;
let renderToken = 0;

const app = document.querySelector('#app');
document.addEventListener('submit', onSubmit);
document.addEventListener('click', onClick);
document.addEventListener('change', onChange);
window.addEventListener('hashchange', () => { render(); });

if (!location.hash) location.hash = '#/';
render();

function parseHash() {
  const raw = (location.hash || '#/').replace(/^#/, '') || '/';
  const [path, search = ''] = raw.split('?');
  return { path: path.startsWith('/') ? path : `/${path}`, query: new URLSearchParams(search) };
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

async function loadMeta() {
  if (!metaPromise) {
    metaPromise = api('/api/meta').catch((error) => {
      metaPromise = null;
      throw error;
    });
  }
  metaData = await metaPromise;
  return metaData;
}

async function render() {
  const token = ++renderToken;
  const note = flash;
  flash = null;
  app.innerHTML = shell('<p class="loading">Loading the yard register…</p>', null, note);
  try {
    const heat = await api('/api/heat');
    const view = match(parseHash().path);
    const content = await view();
    if (token !== renderToken) return;
    app.innerHTML = shell(content, heat, note);
  } catch (error) {
    if (token !== renderToken) return;
    app.innerHTML = shell(`<p class="banner bad">${esc(error.message)}</p>`, null, null);
  }
}

function match(path) {
  const routes = [
    [/^\/incidents\/new$/, viewIncidentForm],
    [/^\/incidents\/(\d+)$/, (id) => viewIncident(Number(id))],
    [/^\/incidents$/, viewIncidents],
    [/^\/observations\/new$/, viewObservationForm],
    [/^\/observations$/, viewObservations],
    [/^\/risks\/new$/, viewRiskForm],
    [/^\/risks\/(\d+)$/, (id) => viewRisk(Number(id))],
    [/^\/risks$/, viewRisks],
    [/^\/permits\/new$/, viewPermitForm],
    [/^\/permits\/(\d+)$/, (id) => viewPermit(Number(id))],
    [/^\/permits$/, viewPermits],
    [/^\/inspections\/new$/, viewInspectionForm],
    [/^\/inspections\/(\d+)$/, (id) => viewInspection(Number(id))],
    [/^\/inspections$/, viewInspections],
    [/^\/actions\/new$/, viewActionForm],
    [/^\/actions$/, viewActions],
    [/^\/training\/new$/, viewTrainingForm],
    [/^\/training$/, viewTraining],
    [/^\/heat$/, viewHeat],
    [/^\/$/, viewDashboard],
  ];
  for (const [pattern, view] of routes) {
    const found = path.match(pattern);
    if (found) return () => view(...found.slice(1));
  }
  return async () => '<p class="empty">That page is not in the register.</p>';
}

function shell(content, heat, note) {
  const { path } = parseHash();
  const nav = NAV.map(([href, name, prefix]) => {
    const active = prefix === '/' ? path === '/' : path === prefix || path.startsWith(`${prefix}/`);
    return `<a class="nav ${active ? 'active' : ''}" href="${href}">${esc(name)}</a>`;
  }).join('');
  const pill = heat?.latest
    ? `<div class="heat-pill ${heat.alert ? 'hot' : ''}"><span>${heat.alert ? 'Heat alert' : 'Heat index'}</span><strong>${esc(fmtNum(heat.latest.heatIndexC, 1))}°</strong><span>${esc(heat.latest.location)}</span></div>`
    : '<div class="heat-pill"><span>Heat index</span><strong>—</strong></div>';
  const banner = note ? `<div class="banner ${note.tone === 'bad' ? 'bad' : ''}" role="status">${esc(note.message)}</div>` : '';
  return `
    <div class="app">
      <aside class="rail">
        <a class="brand" href="#/"><span class="brand-mark">H</span><span><strong>HSE Ledger</strong><small>Fabrication yard</small></span></a>
        <nav>${nav}</nav>
        <p class="rail-foot">Sample yard data for a steel fabrication shop. Names and figures are fictional.</p>
      </aside>
      <section class="main">
        <header class="top">
          <div>
            <p class="eyebrow">Jubail fabrication yard</p>
            <p class="today">${esc(yardClock())} · Asia/Riyadh</p>
          </div>
          ${pill}
        </header>
        ${banner}
        ${content}
      </section>
    </div>`;
}

function chip(value) {
  return `<span class="chip ${esc(value)}">${esc(label(value))}</span>`;
}

function head(title, lede, action) {
  return `<div class="page-head"><div><h1>${esc(title)}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div>${action || ''}</div>`;
}

function linkButton(href, text) {
  return `<a class="button" href="${href}">${esc(text)}</a>`;
}

function options(values, selected, text = label) {
  return values.map((value) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(text(value))}</option>`).join('');
}

function personOptions(people, selected) {
  const blank = `<option value="">Choose a person</option>`;
  const items = people.map((person) => `<option value="${esc(person.name)}" ${person.name === selected ? 'selected' : ''}>${esc(person.name)} · ${esc(person.role)}</option>`).join('');
  return blank + items;
}

function locationOptions(selected) {
  const locations = metaData?.locations || [];
  return `<option value="">Choose a location</option>` + locations.map((place) => `<option ${place === selected ? 'selected' : ''}>${esc(place)}</option>`).join('');
}

function field(id, title, control, wide = false) {
  return `<label class="field ${wide ? 'wide' : ''}" for="${id}"><span>${esc(title)}</span>${control}</label>`;
}

async function viewDashboard() {
  const data = await api('/api/dashboard');
  const stats = [
    ['TRIR', fmtNum(data.trir, 2), `${fmtNum(data.recordable)} recordable`],
    ['LTIFR', fmtNum(data.ltifr, 2), `${fmtNum(data.lti)} lost-time`],
    ['Open incidents', fmtNum(data.openIncidents), `${fmtNum(data.nearMiss)} near misses on file`],
    ['Overdue actions', fmtNum(data.overdueActions), `${fmtNum(data.openActions)} still open`, data.overdueActions ? 'alert' : ''],
    ['Live permits', fmtNum(data.activePermits), 'Issued or active'],
    ['Expired cards', fmtNum(data.expiredTraining), 'Training past its date', data.expiredTraining ? 'alert' : ''],
  ];
  const max = Math.max(1, ...data.months.flatMap((month) => [month.incidents, month.observations]));
  const bars = data.months.map((month) => `
    <div class="bar">
      <i style="height:${(month.incidents / max) * 84}px" title="${month.incidents} incidents"></i>
      <i class="obs" style="height:${(month.observations / max) * 84}px" title="${month.observations} observations"></i>
      <b>${esc(fmtMonth(month.month))}</b>
    </div>`).join('');
  const attention = data.attention.length
    ? `<ul class="attention">${data.attention.map((item) => `<li><a class="${esc(item.tone)}" href="${esc(item.href)}"><span class="kind">${esc(item.kind)}</span><span>${esc(item.title)}</span></a></li>`).join('')}</ul>`
    : '<p class="empty">Nothing is overdue or expiring today.</p>';
  const recent = data.recent.map((item) => `<tr><td><a class="ref" href="#/incidents/${item.id}">${esc(item.ref)}</a></td><td>${esc(item.title)}</td><td>${chip(item.severity)}</td><td>${chip(item.status)}</td></tr>`).join('');
  return `
    ${head('Yard board', 'Leading and lagging indicators for the fabrication yard. Rates use the hours worked figure below.')}
    <p class="sample">Sample data. TRIR is recordable cases × 200,000 / hours. LTIFR is lost-time injuries × 1,000,000 / hours.</p>
    <div class="stats">${stats.map(([name, value, note, tone]) => `<article class="stat ${tone || ''}"><p>${esc(name)}</p><strong>${esc(value)}</strong><span>${esc(note)}</span></article>`).join('')}</div>
    <div class="split">
      <div class="stack">
        <section class="panel">
          <h2>Needs attention</h2>
          ${attention}
        </section>
        <section class="panel">
          <h2>Last six months</h2>
          <p class="legend"><span><i class="swatch inc"></i>Incidents</span><span><i class="swatch obs"></i>Observations</span></p>
          <div class="bars">${bars}</div>
        </section>
        <section class="panel">
          <h2>Recent incidents</h2>
          <div class="table-wrap"><table><thead><tr><th>Ref</th><th>Title</th><th>Severity</th><th>Status</th></tr></thead><tbody>${recent}</tbody></table></div>
        </section>
      </div>
      <div class="stack">
        <section class="panel">
          <h2>Heat index</h2>
          ${sparkline(data.heat.items, data.heat.threshold)}
          <p class="hint">${data.heat.alert ? 'The latest reading is at or above the alert line.' : `Alert line is ${fmtNum(data.heat.threshold, 0)}°C. The latest reading is below it.`}</p>
        </section>
        <section class="panel">
          <h2>Observations</h2>
          <div class="mix">
            <div><span>Safe</span><strong>${fmtNum(data.safeObservations)}</strong></div>
            <div><span>At risk</span><strong>${fmtNum(data.atRiskObservations)}</strong></div>
          </div>
        </section>
        <section class="panel">
          <h2>Hours worked</h2>
          <form data-form="hours" class="hours">
            <label class="field" for="hours-worked"><span>Hours this year</span><input id="hours-worked" name="hoursWorked" type="number" min="1" step="1" value="${esc(data.hoursWorked)}" required></label>
            <button type="submit">Update hours</button>
          </form>
          <p class="hint">Changing the hours recalculates TRIR and LTIFR from the incidents already on file.</p>
        </section>
      </div>
    </div>`;
}

function sparkline(items, threshold) {
  const points = [...items].reverse();
  if (!points.length) return '<p class="empty">No heat readings yet.</p>';
  const values = points.map((point) => point.heatIndexC);
  const min = Math.min(...values, threshold) - 1;
  const max = Math.max(...values, threshold) + 1;
  const width = 320;
  const height = 78;
  const y = (value) => height - ((value - min) / (max - min)) * (height - 10) - 5;
  const coords = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * width},${y(value)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" role="img" aria-label="Recent heat index"><line class="threshold" x1="0" x2="${width}" y1="${y(threshold)}" y2="${y(threshold)}"></line><polyline points="${coords}"></polyline></svg>`;
}

async function viewIncidents() {
  const { query } = parseHash();
  const data = await api(`/api/incidents?${query.toString()}`);
  const rows = data.items.length
    ? data.items.map((item) => `<tr><td><a class="ref" href="#/incidents/${item.id}">${esc(item.ref)}</a></td><td><a href="#/incidents/${item.id}">${esc(item.title)}</a></td><td>${chip(item.type)}</td><td>${chip(item.severity)}</td><td>${esc(item.location)}</td><td>${esc(fmtWhen(item.occurredAt))}</td><td>${chip(item.status)}</td></tr>`).join('')
    : '<tr><td colspan="7" class="empty">No incidents match this filter.</td></tr>';
  return `
    ${head('Incidents', 'Injuries, near misses, fires, property damage, and environmental releases.', linkButton('#/incidents/new', 'Report incident'))}
    <form class="filters" data-filter="incidents">
      ${field('incident-filter-status', 'Status', `<select id="incident-filter-status" name="status">${options(['', ...INCIDENT_STATUSES], query.get('status') || '', (value) => value ? label(value) : 'All')}</select>`)}
      ${field('incident-filter-type', 'Type', `<select id="incident-filter-type" name="type">${options(['', ...INCIDENT_TYPES], query.get('type') || '', (value) => value ? label(value) : 'All')}</select>`)}
      ${field('incident-filter-q', 'Search', `<input id="incident-filter-q" name="q" value="${esc(query.get('q') || '')}" placeholder="Ref, title, or location">`)}
      <button type="submit">Apply</button>
    </form>
    <div class="table-wrap panel" style="margin-top:14px"><table><thead><tr><th>Ref</th><th>Title</th><th>Type</th><th>Severity</th><th>Location</th><th>When</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function viewIncidentForm() {
  const meta = await loadMeta();
  return `
    ${head('Report an incident', 'The record opens as reported. Classification as recordable or lost-time applies to injuries only.')}
    <form class="panel form-grid" data-form="incident">
      ${field('incident-type', 'Type', `<select id="incident-type" name="type" required>${options(INCIDENT_TYPES, 'near_miss')}</select>`)}
      ${field('incident-severity', 'Severity', `<select id="incident-severity" name="severity" required>${options(SEVERITIES, 'medium')}</select>`)}
      ${field('incident-title', 'Title', '<input id="incident-title" name="title" required maxlength="160">')}
      ${field('incident-location', 'Location', `<select id="incident-location" name="location" required>${locationOptions('')}</select>`)}
      ${field('incident-when', 'When', `<input id="incident-when" name="occurredAt" type="datetime-local" required value="${esc(nowInput())}">`)}
      ${field('incident-reporter', 'Reported by', `<select id="incident-reporter" name="reportedBy" required>${personOptions(meta.people, '')}</select>`)}
      ${field('incident-description', 'What happened', '<textarea id="incident-description" name="description" required></textarea>', true)}
      ${field('incident-immediate', 'Immediate action', '<textarea id="incident-immediate" name="immediateAction"></textarea>', true)}
      <div class="checks">
        <label><input id="incident-recordable" name="recordable" type="checkbox"> Recordable injury</label>
        <label><input id="incident-lti" name="lti" type="checkbox"> Lost-time injury</label>
      </div>
      <button type="submit">Save incident</button>
    </form>`;
}

async function viewIncident(id) {
  const incident = await api(`/api/incidents/${id}`);
  const actions = incident.actions.length
    ? incident.actions.map((action) => `<tr class="${action.overdue ? 'overdue' : ''}"><td class="ref">${esc(action.ref)}</td><td>${esc(action.title)}</td><td>${esc(action.owner)}</td><td>${esc(fmtDay(action.dueOn))}</td><td>${chip(action.status)}</td></tr>`).join('')
    : '<tr><td colspan="5" class="empty">No actions cite this reference yet.</td></tr>';
  return `
    ${head(incident.ref, incident.title)}
    <section class="panel">
      <dl class="detail">
        <dt>Type</dt><dd>${chip(incident.type)}</dd>
        <dt>Severity</dt><dd>${chip(incident.severity)}</dd>
        <dt>Status</dt><dd>${chip(incident.status)}</dd>
        <dt>When</dt><dd>${esc(fmtWhen(incident.occurredAt))}</dd>
        <dt>Location</dt><dd>${esc(incident.location)}</dd>
        <dt>Reported by</dt><dd>${esc(incident.reportedBy)}</dd>
        <dt>Recordable</dt><dd>${incident.recordable ? 'Yes' : 'No'}</dd>
        <dt>Lost time</dt><dd>${incident.lti ? 'Yes' : 'No'}</dd>
        <dt>What happened</dt><dd class="prose">${esc(incident.description)}</dd>
        <dt>Immediate action</dt><dd class="prose">${esc(incident.immediateAction || '—')}</dd>
        <dt>Investigation</dt><dd class="prose">${esc(incident.investigation || '—')}</dd>
      </dl>
    </section>
    <form class="panel form-grid" data-form="incident-update" style="margin-top:16px">
      <input type="hidden" name="id" value="${incident.id}">
      ${field('incident-status', 'Status', `<select id="incident-status" name="status">${options(INCIDENT_STATUSES, incident.status)}</select>`)}
      ${field('incident-investigation', 'Investigation note', `<textarea id="incident-investigation" name="investigation">${esc(incident.investigation)}</textarea>`, true)}
      <p class="hint">Closing requires an investigation note.</p>
      <button type="submit">Save incident update</button>
    </form>
    <section class="panel" style="margin-top:16px">
      <h2>Linked actions</h2>
      <div class="table-wrap"><table><thead><tr><th>Ref</th><th>Action</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead><tbody>${actions}</tbody></table></div>
    </section>`;
}

async function viewObservations() {
  const { query } = parseHash();
  const data = await api(`/api/observations?${query.toString()}`);
  const rows = data.items.length
    ? data.items.map((item) => `<tr><td class="ref">${esc(item.ref)}</td><td>${chip(item.kind)}</td><td>${chip(item.category)}</td><td>${esc(item.description)}</td><td>${esc(item.location)}</td><td>${esc(item.observer)}</td><td>${esc(fmtWhen(item.observedAt))}</td></tr>`).join('')
    : '<tr><td colspan="7" class="empty">No observations match this filter.</td></tr>';
  return `
    ${head('Observations', 'Behavior-based notes from the floor: what was safe, and what was at risk.', linkButton('#/observations/new', 'Log observation'))}
    <form class="filters" data-filter="observations">
      ${field('obs-kind', 'Kind', `<select id="obs-kind" name="kind">${options(['', ...OBSERVATION_KINDS], query.get('kind') || '', (value) => value ? label(value) : 'All')}</select>`)}
      ${field('obs-category', 'Category', `<select id="obs-category" name="category">${options(['', ...OBSERVATION_CATEGORIES], query.get('category') || '', (value) => value ? label(value) : 'All')}</select>`)}
      <button type="submit">Apply</button>
    </form>
    <div class="table-wrap panel" style="margin-top:14px"><table><thead><tr><th>Ref</th><th>Kind</th><th>Category</th><th>Note</th><th>Location</th><th>Observer</th><th>When</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function viewObservationForm() {
  const meta = await loadMeta();
  return `
    ${head('Log an observation', 'Keep it to what was seen. Safe acts belong here as much as at-risk ones.')}
    <form class="panel form-grid" data-form="observation">
      ${field('observation-kind', 'Kind', `<select id="observation-kind" name="kind" required>${options(OBSERVATION_KINDS, 'at_risk')}</select>`)}
      ${field('observation-category', 'Category', `<select id="observation-category" name="category" required>${options(OBSERVATION_CATEGORIES, 'housekeeping')}</select>`)}
      ${field('observation-location', 'Location', `<select id="observation-location" name="location" required>${locationOptions('')}</select>`)}
      ${field('observation-observer', 'Observer', `<select id="observation-observer" name="observer" required>${personOptions(meta.people, '')}</select>`)}
      ${field('observation-when', 'When', `<input id="observation-when" name="observedAt" type="datetime-local" required value="${esc(nowInput())}">`)}
      ${field('observation-description', 'What was seen', '<textarea id="observation-description" name="description" required></textarea>', true)}
      <button type="submit">Save observation</button>
    </form>`;
}

async function viewRisks() {
  const data = await api('/api/risks');
  const rows = data.items.map((item) => `<tr><td><a class="ref" href="#/risks/${item.id}">${esc(item.ref)}</a></td><td><a href="#/risks/${item.id}">${esc(item.task)}</a></td><td>${esc(item.area)}</td><td>${chip(item.residualBand)}</td><td>${chip(item.status)}</td><td>${esc(fmtDay(item.assessedOn))}</td></tr>`).join('');
  return `
    ${head('Risk assessments', 'Task hazards scored on a 5×5 matrix, with residual risk after the controls named on the sheet.', linkButton('#/risks/new', 'New assessment'))}
    <div class="table-wrap panel"><table><thead><tr><th>Ref</th><th>Task</th><th>Area</th><th>Residual</th><th>Status</th><th>Date</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">No assessments yet.</td></tr>'}</tbody></table></div>`;
}

function hazardFields() {
  const score = [1, 2, 3, 4, 5].map((value) => `<option value="${value}">${value}</option>`).join('');
  return `<fieldset class="hazard" data-hazard>
    <label class="field"><span>Hazard</span><input name="hazard" required></label>
    <label class="field"><span>Consequence</span><input name="consequence" required></label>
    <label class="field"><span>Likelihood</span><select name="likelihood" required>${score}</select></label>
    <label class="field"><span>Severity</span><select name="severity" required>${score}</select></label>
    <label class="field wide"><span>Controls</span><input name="controls" required></label>
    <label class="field"><span>Residual likelihood</span><select name="residualLikelihood" required>${score}</select></label>
    <label class="field"><span>Residual severity</span><select name="residualSeverity" required>${score}</select></label>
  </fieldset>`;
}

async function viewRiskForm() {
  const meta = await loadMeta();
  return `
    ${head('New risk assessment', 'Score likelihood and severity from 1 to 5 before and after controls. 1–4 low, 5–9 medium, 10–16 high, 17–25 extreme.')}
    <form class="panel" data-form="risk">
      <div class="form-grid">
        ${field('risk-task', 'Task', '<input id="risk-task" name="task" required maxlength="200">')}
        ${field('risk-area', 'Area', `<select id="risk-area" name="area" required>${locationOptions('')}</select>`)}
        ${field('risk-assessor', 'Assessor', `<select id="risk-assessor" name="assessor" required>${personOptions(meta.people, '')}</select>`)}
        ${field('risk-date', 'Date', `<input id="risk-date" name="assessedOn" type="date" required value="${esc(todayInput())}">`)}
      </div>
      <h2 style="margin:16px 0 8px">Hazards</h2>
      <div id="hazards">${hazardFields()}</div>
      <div class="actions"><button type="button" class="ghost" data-act="add-hazard">Add hazard</button><button type="submit">Save assessment</button></div>
    </form>`;
}

async function viewRisk(id) {
  const risk = await api(`/api/risks/${id}`);
  const rows = risk.hazards.map((hazard) => `<tr><td>${esc(hazard.hazard)}</td><td>${esc(hazard.consequence)}</td><td>${hazard.likelihood}×${hazard.severity} ${chip(hazard.band)}</td><td>${esc(hazard.controls)}</td><td>${hazard.residualLikelihood}×${hazard.residualSeverity} ${chip(hazard.residualBand)}</td></tr>`).join('');
  const approve = risk.status === 'draft' ? '<button type="button" data-act="approve-risk" data-id="' + risk.id + '">Approve assessment</button>' : '';
  return `
    ${head(risk.ref, risk.task)}
    <section class="panel">
      <dl class="detail">
        <dt>Area</dt><dd>${esc(risk.area)}</dd>
        <dt>Assessor</dt><dd>${esc(risk.assessor)}</dd>
        <dt>Date</dt><dd>${esc(fmtDay(risk.assessedOn))}</dd>
        <dt>Status</dt><dd>${chip(risk.status)}</dd>
        <dt>Worst residual</dt><dd>${chip(risk.residualBand)}</dd>
      </dl>
      <div class="actions">${approve}</div>
    </section>
    <section class="panel" style="margin-top:16px">
      <h2>Hazards</h2>
      <div class="table-wrap"><table><thead><tr><th>Hazard</th><th>Consequence</th><th>Initial</th><th>Controls</th><th>Residual</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>`;
}

async function viewPermits() {
  const data = await api('/api/permits');
  const rows = data.items.map((item) => `<tr><td><a class="ref" href="#/permits/${item.id}">${esc(item.ref)}</a></td><td>${chip(item.type)}</td><td>${esc(item.location)}</td><td>${esc(item.acceptor)}</td><td>${esc(fmtDay(item.validFrom))} – ${esc(fmtDay(item.validTo))}</td><td>${chip(item.status)}${item.expiring ? ' <span class="chip high">Expiring</span>' : ''}</td></tr>`).join('');
  return `
    ${head('Permits to work', 'Hot work, height, confined space, lifting, excavation, and electrical isolation.', linkButton('#/permits/new', 'Request permit'))}
    <div class="table-wrap panel"><table><thead><tr><th>Ref</th><th>Type</th><th>Location</th><th>Acceptor</th><th>Validity</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">No permits yet.</td></tr>'}</tbody></table></div>`;
}

async function viewPermitForm() {
  const meta = await loadMeta();
  return `
    ${head('Request a permit', 'A request starts in requested. The permit controller issues it before the job goes active.')}
    <form class="panel form-grid" data-form="permit">
      ${field('permit-type', 'Type', `<select id="permit-type" name="type" required>${options(PERMIT_TYPES, 'hot_work')}</select>`)}
      ${field('permit-location', 'Location', `<select id="permit-location" name="location" required>${locationOptions('')}</select>`)}
      ${field('permit-issuer', 'Issuer', `<select id="permit-issuer" name="issuer" required>${personOptions(meta.people, 'Yusuf Darwish')}</select>`)}
      ${field('permit-acceptor', 'Acceptor', `<select id="permit-acceptor" name="acceptor" required>${personOptions(meta.people, '')}</select>`)}
      ${field('permit-from', 'Valid from', `<input id="permit-from" name="validFrom" type="date" required value="${esc(todayInput())}">`)}
      ${field('permit-to', 'Valid to', `<input id="permit-to" name="validTo" type="date" required value="${esc(todayInput())}">`)}
      ${field('permit-description', 'Work description', '<textarea id="permit-description" name="description" required></textarea>', true)}
      ${field('permit-controls', 'Controls', '<textarea id="permit-controls" name="controls" required></textarea>', true)}
      <button type="submit">Submit permit request</button>
    </form>`;
}

async function viewPermit(id) {
  const permit = await api(`/api/permits/${id}`);
  const buttons = (PERMIT_NEXT[permit.status] || []).map(([status, text]) => `<button type="button" data-act="permit-status" data-id="${permit.id}" data-status="${esc(status)}">${esc(text)}</button>`).join('');
  return `
    ${head(permit.ref, label(permit.type))}
    <section class="panel">
      <dl class="detail">
        <dt>Status</dt><dd>${chip(permit.status)}${permit.expiring ? ' <span class="chip high">Expiring</span>' : ''}</dd>
        <dt>Location</dt><dd>${esc(permit.location)}</dd>
        <dt>Issuer</dt><dd>${esc(permit.issuer)}</dd>
        <dt>Acceptor</dt><dd>${esc(permit.acceptor)}</dd>
        <dt>Valid</dt><dd>${esc(fmtDay(permit.validFrom))} – ${esc(fmtDay(permit.validTo))}</dd>
        <dt>Work</dt><dd class="prose">${esc(permit.description)}</dd>
        <dt>Controls</dt><dd class="prose">${esc(permit.controls)}</dd>
      </dl>
      <div class="actions">${buttons || '<p class="hint">This permit is finished.</p>'}</div>
    </section>`;
}

async function viewInspections() {
  const data = await api('/api/inspections');
  const rows = data.items.map((item) => `<tr><td><a class="ref" href="#/inspections/${item.id}">${esc(item.ref)}</a></td><td>${esc(item.templateTitle)}</td><td>${esc(item.area)}</td><td>${esc(item.inspector)}</td><td>${esc(fmtDay(item.inspectedOn))}</td><td>${chip(item.status)}</td></tr>`).join('');
  return `
    ${head('Inspections', 'Walkdowns for the workshop, welding bays, lifting gear, and fire equipment.', linkButton('#/inspections/new', 'Start inspection'))}
    <div class="table-wrap panel"><table><thead><tr><th>Ref</th><th>Template</th><th>Area</th><th>Inspector</th><th>Date</th><th>Result</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">No inspections yet.</td></tr>'}</tbody></table></div>`;
}

function checklistFields(templateKey) {
  const template = metaData.templates[templateKey];
  return template.items.map((item, index) => `
    <div class="check-row">
      <label class="field"><span>Item ${index + 1}</span><input name="label" value="${esc(item)}" readonly></label>
      <label class="field"><span>Result</span><select name="result"><option value="pass">Pass</option><option value="fail">Fail</option><option value="na">N/A</option></select></label>
      <label class="field"><span>Note</span><input name="note" placeholder="Required in practice when this fails"></label>
    </div>`).join('');
}

async function viewInspectionForm() {
  const meta = await loadMeta();
  const templates = Object.keys(meta.templates);
  return `
    ${head('Start an inspection', 'A failed item marks the inspection as actions required.')}
    <form class="panel" data-form="inspection">
      <div class="form-grid">
        ${field('inspection-template', 'Template', `<select id="inspection-template" name="template">${templates.map((key) => `<option value="${esc(key)}">${esc(meta.templates[key].title)}</option>`).join('')}</select>`)}
        ${field('inspection-area', 'Area', `<select id="inspection-area" name="area" required>${locationOptions('')}</select>`)}
        ${field('inspection-inspector', 'Inspector', `<select id="inspection-inspector" name="inspector" required>${personOptions(meta.people, '')}</select>`)}
        ${field('inspection-date', 'Date', `<input id="inspection-date" name="inspectedOn" type="date" required value="${esc(todayInput())}">`)}
      </div>
      <div id="checklist" style="margin-top:14px">${checklistFields(templates[0])}</div>
      <div class="actions"><button type="submit">Save inspection</button></div>
    </form>`;
}

async function viewInspection(id) {
  const inspection = await api(`/api/inspections/${id}`);
  const rows = inspection.items.map((item) => `<tr><td>${esc(item.label)}</td><td>${chip(item.result)}</td><td>${esc(item.note || '—')}</td></tr>`).join('');
  return `
    ${head(inspection.ref, inspection.templateTitle)}
    <section class="panel">
      <dl class="detail">
        <dt>Area</dt><dd>${esc(inspection.area)}</dd>
        <dt>Inspector</dt><dd>${esc(inspection.inspector)}</dd>
        <dt>Date</dt><dd>${esc(fmtDay(inspection.inspectedOn))}</dd>
        <dt>Result</dt><dd>${chip(inspection.status)}</dd>
      </dl>
    </section>
    <section class="panel" style="margin-top:16px"><div class="table-wrap"><table><thead><tr><th>Item</th><th>Result</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

async function viewActions() {
  const { query } = parseHash();
  const data = await api(`/api/actions?${query.toString()}`);
  const rows = data.items.length
    ? data.items.map((item) => `<tr class="${item.overdue ? 'overdue' : ''}"><td class="ref">${esc(item.ref)}</td><td>${esc(item.title)}</td><td>${esc(item.source)}</td><td>${esc(item.owner)}</td><td>${esc(fmtDay(item.dueOn))}</td><td>${chip(item.priority)}</td><td>${chip(item.status)}${item.overdue ? ' <span class="chip high">Overdue</span>' : ''}</td><td>${item.status === 'closed' ? '' : `<button type="button" data-act="close-action" data-id="${item.id}">Mark ${esc(item.ref)} closed</button>`}</td></tr>`).join('')
    : '<tr><td colspan="8" class="empty">No actions match this filter.</td></tr>';
  return `
    ${head('Actions', 'Corrective actions from incidents, inspections, and permits. Overdue rows stay highlighted until they are closed.', linkButton('#/actions/new', 'Add action'))}
    <form class="filters" data-filter="actions">
      ${field('action-filter', 'Status', `<select id="action-filter" name="status">${['', 'open', 'in_progress', 'closed', 'overdue'].map((value) => `<option value="${esc(value)}" ${query.get('status') === value || (!query.get('status') && value === '') ? 'selected' : ''}>${esc(value === '' ? 'All' : value === 'overdue' ? 'Overdue' : label(value))}</option>`).join('')}</select>`)}
      <button type="submit">Apply</button>
    </form>
    <div class="table-wrap panel" style="margin-top:14px"><table><thead><tr><th>Ref</th><th>Action</th><th>Source</th><th>Owner</th><th>Due</th><th>Priority</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function viewActionForm() {
  const meta = await loadMeta();
  return `
    ${head('Add an action', 'Cite the source reference, for example an incident or inspection number.')}
    <form class="panel form-grid" data-form="action">
      ${field('action-title', 'Action', '<input id="action-title" name="title" required maxlength="200">')}
      ${field('action-source', 'Source ref', '<input id="action-source" name="source" required maxlength="80" placeholder="INC-2026-001">')}
      ${field('action-owner', 'Owner', `<select id="action-owner" name="owner" required>${personOptions(meta.people, '')}</select>`)}
      ${field('action-due', 'Due', `<input id="action-due" name="dueOn" type="date" required value="${esc(todayInput())}">`)}
      ${field('action-priority', 'Priority', `<select id="action-priority" name="priority" required>${options(PRIORITIES, 'medium')}</select>`)}
      ${field('action-note', 'Note', '<textarea id="action-note" name="note"></textarea>', true)}
      <button type="submit">Save action</button>
    </form>`;
}

async function viewTraining() {
  const data = await api('/api/training');
  const rows = data.items.map((item) => `<tr class="${item.expired ? 'overdue' : ''}"><td>${esc(item.person)}</td><td>${esc(item.course)}</td><td>${esc(fmtDay(item.completedOn))}</td><td>${esc(fmtDay(item.expiresOn))}</td><td>${item.expired ? '<span class="chip high">Expired</span>' : '<span class="chip low">Current</span>'}</td></tr>`).join('');
  return `
    ${head('Training', 'Competency cards for the yard. Expired cards are highlighted.', linkButton('#/training/new', 'Add card'))}
    <div class="table-wrap panel"><table><thead><tr><th>Person</th><th>Course</th><th>Completed</th><th>Expires</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">No training cards yet.</td></tr>'}</tbody></table></div>`;
}

async function viewTrainingForm() {
  const meta = await loadMeta();
  return `
    ${head('Add a training card')}
    <form class="panel form-grid" data-form="training">
      ${field('training-person', 'Person', `<select id="training-person" name="person" required>${personOptions(meta.people, '')}</select>`)}
      ${field('training-course', 'Course', `<select id="training-course" name="course" required>${meta.courses.map((course) => `<option>${esc(course)}</option>`).join('')}</select>`)}
      ${field('training-completed', 'Completed', `<input id="training-completed" name="completedOn" type="date" required value="${esc(todayInput())}">`)}
      ${field('training-expires', 'Expires', `<input id="training-expires" name="expiresOn" type="date" required value="${esc(todayInput())}">`)}
      <button type="submit">Save card</button>
    </form>`;
}

async function viewHeat() {
  await loadMeta();
  const data = await api('/api/heat');
  const rows = data.items.map((item) => `<tr class="${item.alert ? 'overdue' : ''}"><td>${esc(fmtWhen(item.recordedAt))}</td><td>${esc(item.location)}</td><td>${esc(fmtNum(item.heatIndexC, 1))}</td><td>${item.alert ? '<span class="chip high">Alert</span>' : '<span class="chip low">Below line</span>'}</td></tr>`).join('');
  return `
    ${head('Heat stress', `Mobile-style log of the yard heat index. Readings at or above ${fmtNum(data.threshold, 0)}°C raise an alert.`)}
    ${data.alert ? '<p class="banner bad">The latest heat index is at or above the alert line. Hydrate, rest, and seek shade.</p>' : ''}
    <form class="panel form-grid" data-form="heat">
      ${field('heat-location', 'Location', `<select id="heat-location" name="location" required>${locationOptions(data.latest?.location || '')}</select>`)}
      ${field('heat-index', 'Heat index °C', '<input id="heat-index" name="heatIndexC" type="number" min="15" max="70" step="0.1" required>')}
      ${field('heat-when', 'When', `<input id="heat-when" name="recordedAt" type="datetime-local" value="${esc(nowInput())}">`)}
      <button type="submit">Log reading</button>
    </form>
    <section class="panel" style="margin-top:16px">
      ${sparkline(data.items, data.threshold)}
      <div class="table-wrap"><table><thead><tr><th>When</th><th>Location</th><th>°C</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty">No readings yet.</td></tr>'}</tbody></table></div>
    </section>`;
}

async function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.dataset.filter) {
    event.preventDefault();
    const params = new URLSearchParams(new FormData(form));
    for (const [key, value] of [...params.entries()]) if (!value) params.delete(key);
    const query = params.toString();
    go(`#/${form.dataset.filter}${query ? `?${query}` : ''}`);
    return;
  }
  if (!form.dataset.form) return;
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    await submitForm(form);
  } catch (error) {
    flash = { tone: 'bad', message: error.message };
    if (button) button.disabled = false;
    const host = document.querySelector('.main');
    if (host && !host.querySelector('.banner.bad')) {
      host.insertAdjacentHTML('afterbegin', `<div class="banner bad" role="status">${esc(error.message)}</div>`);
    }
  }
}

async function submitForm(form) {
  const data = new FormData(form);
  const value = (name) => String(data.get(name) || '').trim();
  switch (form.dataset.form) {
    case 'hours': {
      const saved = await api('/api/settings', { method: 'PATCH', body: { hoursWorked: Number(value('hoursWorked')) } });
      flash = { tone: 'ok', message: `Hours updated. TRIR is now ${fmtNum(saved.trir, 2)}.` };
      go('#/');
      return;
    }
    case 'incident': {
      const saved = await api('/api/incidents', {
        method: 'POST',
        body: {
          type: value('type'),
          severity: value('severity'),
          title: value('title'),
          description: value('description'),
          location: value('location'),
          occurredAt: value('occurredAt'),
          reportedBy: value('reportedBy'),
          immediateAction: value('immediateAction'),
          recordable: form.querySelector('[name="recordable"]').checked,
          lti: form.querySelector('[name="lti"]').checked,
        },
      });
      flash = { tone: 'ok', message: `${saved.ref} saved.` };
      go(`#/incidents/${saved.id}`);
      return;
    }
    case 'incident-update': {
      const saved = await api(`/api/incidents/${value('id')}`, {
        method: 'PATCH',
        body: { status: value('status'), investigation: value('investigation') },
      });
      flash = { tone: 'ok', message: `${saved.ref} updated.` };
      go(`#/incidents/${saved.id}`);
      return;
    }
    case 'observation': {
      const saved = await api('/api/observations', {
        method: 'POST',
        body: {
          kind: value('kind'),
          category: value('category'),
          description: value('description'),
          location: value('location'),
          observedAt: value('observedAt'),
          observer: value('observer'),
        },
      });
      flash = { tone: 'ok', message: `${saved.ref} logged.` };
      go('#/observations');
      return;
    }
    case 'risk': {
      const hazards = [...form.querySelectorAll('[data-hazard]')].map((row) => ({
        hazard: row.querySelector('[name="hazard"]').value.trim(),
        consequence: row.querySelector('[name="consequence"]').value.trim(),
        likelihood: Number(row.querySelector('[name="likelihood"]').value),
        severity: Number(row.querySelector('[name="severity"]').value),
        controls: row.querySelector('[name="controls"]').value.trim(),
        residualLikelihood: Number(row.querySelector('[name="residualLikelihood"]').value),
        residualSeverity: Number(row.querySelector('[name="residualSeverity"]').value),
      }));
      const saved = await api('/api/risks', {
        method: 'POST',
        body: {
          task: value('task'),
          area: value('area'),
          assessor: value('assessor'),
          assessedOn: value('assessedOn'),
          hazards,
        },
      });
      flash = { tone: 'ok', message: `${saved.ref} saved as a draft.` };
      go(`#/risks/${saved.id}`);
      return;
    }
    case 'permit': {
      const saved = await api('/api/permits', {
        method: 'POST',
        body: {
          type: value('type'),
          location: value('location'),
          description: value('description'),
          issuer: value('issuer'),
          acceptor: value('acceptor'),
          validFrom: value('validFrom'),
          validTo: value('validTo'),
          controls: value('controls'),
        },
      });
      flash = { tone: 'ok', message: `${saved.ref} requested.` };
      go(`#/permits/${saved.id}`);
      return;
    }
    case 'inspection': {
      const labels = [...form.querySelectorAll('[name="label"]')].map((input) => input.value);
      const results = [...form.querySelectorAll('[name="result"]')].map((input) => input.value);
      const notes = [...form.querySelectorAll('[name="note"]')].map((input) => input.value);
      const saved = await api('/api/inspections', {
        method: 'POST',
        body: {
          template: value('template'),
          area: value('area'),
          inspector: value('inspector'),
          inspectedOn: value('inspectedOn'),
          items: labels.map((item, index) => ({ label: item, result: results[index], note: notes[index] })),
        },
      });
      flash = { tone: 'ok', message: `${saved.ref} saved as ${label(saved.status).toLowerCase()}.` };
      go(`#/inspections/${saved.id}`);
      return;
    }
    case 'action': {
      const saved = await api('/api/actions', {
        method: 'POST',
        body: {
          title: value('title'),
          source: value('source'),
          owner: value('owner'),
          dueOn: value('dueOn'),
          priority: value('priority'),
          note: value('note'),
        },
      });
      flash = { tone: 'ok', message: `${saved.ref} added.` };
      go('#/actions');
      return;
    }
    case 'training': {
      await api('/api/training', {
        method: 'POST',
        body: {
          person: value('person'),
          course: value('course'),
          completedOn: value('completedOn'),
          expiresOn: value('expiresOn'),
        },
      });
      flash = { tone: 'ok', message: 'Training card saved.' };
      go('#/training');
      return;
    }
    case 'heat': {
      const saved = await api('/api/heat', {
        method: 'POST',
        body: {
          location: value('location'),
          heatIndexC: Number(value('heatIndexC')),
          recordedAt: value('recordedAt'),
        },
      });
      flash = { tone: saved.alert ? 'bad' : 'ok', message: saved.alert ? `Heat alert at ${fmtNum(saved.heatIndexC, 1)}°C.` : `Reading logged at ${fmtNum(saved.heatIndexC, 1)}°C.` };
      go('#/heat');
      return;
    }
    default:
      throw new Error('Unknown form');
  }
}

async function onClick(event) {
  const button = event.target.closest('[data-act]');
  if (!button) return;
  const act = button.dataset.act;
  if (act === 'add-hazard') {
    document.querySelector('#hazards').insertAdjacentHTML('beforeend', hazardFields());
    return;
  }
  button.disabled = true;
  try {
    if (act === 'close-action') {
      const saved = await api(`/api/actions/${button.dataset.id}`, {
        method: 'PATCH',
        body: { status: 'closed', note: 'Closed from the register.' },
      });
      flash = { tone: 'ok', message: `${saved.ref} closed.` };
      go('#/actions');
    } else if (act === 'permit-status') {
      const saved = await api(`/api/permits/${button.dataset.id}`, {
        method: 'PATCH',
        body: { status: button.dataset.status },
      });
      flash = { tone: 'ok', message: `${saved.ref} is now ${label(saved.status).toLowerCase()}.` };
      go(`#/permits/${saved.id}`);
    } else if (act === 'approve-risk') {
      const saved = await api(`/api/risks/${button.dataset.id}`, {
        method: 'PATCH',
        body: { status: 'approved' },
      });
      flash = { tone: 'ok', message: `${saved.ref} approved.` };
      go(`#/risks/${saved.id}`);
    }
  } catch (error) {
    flash = { tone: 'bad', message: error.message };
    button.disabled = false;
    render();
  }
}

function onChange(event) {
  if (event.target.id !== 'inspection-template' || !metaData) return;
  const host = document.querySelector('#checklist');
  if (host) host.innerHTML = checklistFields(event.target.value);
}
