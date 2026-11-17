import {
  createAction,
  createHeat,
  createIncident,
  createInspection,
  createObservation,
  createPermit,
  createRisk,
  createTraining,
  getDashboard,
  getIncident,
  getInspection,
  getPermit,
  getRisk,
  listActions,
  listHeat,
  listIncidents,
  listInspections,
  listObservations,
  listPermits,
  listRisks,
  listTraining,
  meta,
  patchAction,
  patchIncident,
  patchPermit,
  patchRisk,
  updateHours,
} from './records.js';

const routes = [
  ['GET', /^\/api\/health$/, () => ({ ok: true })],
  ['GET', /^\/api\/meta$/, (_p, _q, _b, db) => meta(db)],
  ['GET', /^\/api\/dashboard$/, (_p, _q, _b, db) => getDashboard(db)],
  ['PATCH', /^\/api\/settings$/, (_p, _q, body, db) => updateHours(db, body)],
  ['GET', /^\/api\/incidents$/, (_p, query, _b, db) => ({ items: listIncidents(db, query) })],
  ['POST', /^\/api\/incidents$/, (_p, _q, body, db) => createIncident(db, body)],
  ['GET', /^\/api\/incidents\/(\d+)$/, (params, _q, _b, db) => required(getIncident(db, id(params)), 'Incident not found')],
  ['PATCH', /^\/api\/incidents\/(\d+)$/, (params, _q, body, db) => patchIncident(db, id(params), body)],
  ['GET', /^\/api\/observations$/, (_p, query, _b, db) => ({ items: listObservations(db, query) })],
  ['POST', /^\/api\/observations$/, (_p, _q, body, db) => createObservation(db, body)],
  ['GET', /^\/api\/risks$/, (_p, _q, _b, db) => ({ items: listRisks(db) })],
  ['POST', /^\/api\/risks$/, (_p, _q, body, db) => createRisk(db, body)],
  ['GET', /^\/api\/risks\/(\d+)$/, (params, _q, _b, db) => required(getRisk(db, id(params)), 'Risk assessment not found')],
  ['PATCH', /^\/api\/risks\/(\d+)$/, (params, _q, body, db) => patchRisk(db, id(params), body)],
  ['GET', /^\/api\/permits$/, (_p, query, _b, db) => ({ items: listPermits(db, query) })],
  ['POST', /^\/api\/permits$/, (_p, _q, body, db) => createPermit(db, body)],
  ['GET', /^\/api\/permits\/(\d+)$/, (params, _q, _b, db) => required(getPermit(db, id(params)), 'Permit not found')],
  ['PATCH', /^\/api\/permits\/(\d+)$/, (params, _q, body, db) => patchPermit(db, id(params), body)],
  ['GET', /^\/api\/inspections$/, (_p, _q, _b, db) => ({ items: listInspections(db) })],
  ['POST', /^\/api\/inspections$/, (_p, _q, body, db) => createInspection(db, body)],
  ['GET', /^\/api\/inspections\/(\d+)$/, (params, _q, _b, db) => required(getInspection(db, id(params)), 'Inspection not found')],
  ['GET', /^\/api\/actions$/, (_p, query, _b, db) => ({ items: listActions(db, query) })],
  ['POST', /^\/api\/actions$/, (_p, _q, body, db) => createAction(db, body)],
  ['PATCH', /^\/api\/actions\/(\d+)$/, (params, _q, body, db) => patchAction(db, id(params), body)],
  ['GET', /^\/api\/training$/, (_p, _q, _b, db) => ({ items: listTraining(db) })],
  ['POST', /^\/api\/training$/, (_p, _q, body, db) => createTraining(db, body)],
  ['GET', /^\/api\/heat$/, (_p, _q, _b, db) => listHeat(db)],
  ['POST', /^\/api\/heat$/, (_p, _q, body, db) => createHeat(db, body)],
];

function id(params) {
  return Number(params[0]);
}

function required(value, message) {
  if (!value) {
    const error = new Error(message);
    error.status = 404;
    throw error;
  }
  return value;
}

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        const error = new Error('Body too large');
        error.status = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        const error = new Error('Invalid JSON');
        error.status = 400;
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

export async function handleApi(db, req, res, url) {
  const match = routes.find(([method, pattern]) => method === req.method && pattern.test(url.pathname));
  if (!match) {
    const exists = routes.some(([, pattern]) => pattern.test(url.pathname));
    send(res, exists ? 405 : 404, { error: exists ? 'Method not allowed' : 'Not found' });
    return;
  }
  const params = url.pathname.match(match[1]).slice(1);
  const query = Object.fromEntries(url.searchParams.entries());
  const body = req.method === 'POST' || req.method === 'PATCH' ? await readBody(req) : {};
  const payload = match[2](params, query, body, db);
  send(res, req.method === 'POST' ? 201 : 200, payload);
}

export function sendError(res, error) {
  const status = error.status || 500;
  if (status === 500) console.error(error);
  send(res, status, { error: status === 500 ? 'Internal error' : error.message });
}
