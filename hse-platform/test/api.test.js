import assert from 'node:assert/strict';
import test from 'node:test';
import { riyadhDate } from '../src/dates.js';
import { createServer } from '../src/server.js';

async function withServer(fn) {
  const { server, db } = createServer({ dbPath: ':memory:' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    db.close();
  }
}

async function send(base, path, options = {}) {
  const response = await fetch(base + path, {
    method: options.method || 'GET',
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  return { status: response.status, data };
}

test('dashboard reports yard rates, overdue work, and a calm heat index', async () => {
  await withServer(async (base) => {
    const { status, data } = await send(base, '/api/dashboard');
    assert.equal(status, 200);
    assert.equal(data.timezone, 'Asia/Riyadh');
    assert.equal(data.recordable, 1);
    assert.equal(data.lti, 0);
    assert.equal(data.trir, 0.41);
    assert.equal(data.ltifr, 0);
    assert.equal(data.hoursWorked, 486000);
    assert.ok(data.overdueActions >= 2);
    assert.equal(data.heat.alert, false);
    assert.ok(data.heat.items.some((reading) => reading.alert));
    assert.ok(data.attention.some((item) => item.kind === 'Action'));
    assert.equal(data.months.length, 6);
  });
});

test('incident close requires an investigation, and lost time is recordable', async () => {
  await withServer(async (base) => {
    const created = await send(base, '/api/incidents', {
      method: 'POST',
      body: {
        type: 'injury',
        severity: 'high',
        title: 'Twisted ankle on a scaffold stair',
        description: 'A fitter missed a step and could not finish the shift.',
        location: 'Scaffold bay 3',
        occurredAt: `${riyadhDate(0)}T07:40`,
        reportedBy: 'Noor Al-Mutairi',
        lti: true,
        immediateAction: 'Medic assessment and stair closed pending a look at the tread.',
      },
    });
    assert.equal(created.status, 201);
    assert.match(created.data.ref, /^INC-\d{4}-\d{3}$/);
    assert.equal(created.data.recordable, true);
    assert.equal(created.data.lti, true);
    assert.equal(created.data.status, 'reported');

    const blocked = await send(base, `/api/incidents/${created.data.id}`, {
      method: 'PATCH',
      body: { status: 'closed', investigation: '   ' },
    });
    assert.equal(blocked.status, 400);

    const closed = await send(base, `/api/incidents/${created.data.id}`, {
      method: 'PATCH',
      body: {
        status: 'closed',
        investigation: 'The tread nosing was worn. It was replaced before the stair was reopened.',
      },
    });
    assert.equal(closed.status, 200);
    assert.equal(closed.data.status, 'closed');

    const listed = await send(base, '/api/incidents?type=injury&q=ankle');
    assert.ok(listed.data.items.some((item) => item.id === created.data.id));
  });
});

test('permit transitions are enforced and a hot reading raises the heat alert', async () => {
  await withServer(async (base) => {
    const permits = await send(base, '/api/permits?status=requested');
    const requested = permits.data.items[0];
    assert.ok(requested);

    const skipped = await send(base, `/api/permits/${requested.id}`, {
      method: 'PATCH',
      body: { status: 'active' },
    });
    assert.equal(skipped.status, 400);

    const issued = await send(base, `/api/permits/${requested.id}`, {
      method: 'PATCH',
      body: { status: 'issued' },
    });
    assert.equal(issued.status, 200);
    assert.equal(issued.data.status, 'issued');

    const reading = await send(base, '/api/heat', {
      method: 'POST',
      body: { location: 'Plate yard', heatIndexC: 44.2 },
    });
    assert.equal(reading.status, 201);
    assert.equal(reading.data.alert, true);

    const dashboard = await send(base, '/api/dashboard');
    assert.equal(dashboard.data.heat.alert, true);
    assert.equal(dashboard.data.heat.latest.heatIndexC, 44.2);
  });
});

test('risk, inspection, action, and hours updates change the register', async () => {
  await withServer(async (base) => {
    const empty = await send(base, '/api/risks', {
      method: 'POST',
      body: {
        task: 'Night plate cutting',
        area: 'Plate yard',
        assessor: 'Samir Rahman',
        assessedOn: riyadhDate(0),
        hazards: [],
      },
    });
    assert.equal(empty.status, 400);

    const risk = await send(base, '/api/risks', {
      method: 'POST',
      body: {
        task: 'Night plate cutting',
        area: 'Plate yard',
        assessor: 'Samir Rahman',
        assessedOn: riyadhDate(0),
        hazards: [
          {
            hazard: 'Unguarded offcut drop',
            consequence: 'Foot injury',
            likelihood: 3,
            severity: 3,
            controls: 'Drop zone marked and boots checked at the gate.',
            residualLikelihood: 2,
            residualSeverity: 2,
          },
        ],
      },
    });
    assert.equal(risk.status, 201);
    assert.equal(risk.data.residualBand, 'low');
    assert.equal(risk.data.hazards[0].score, 9);

    const meta = await send(base, '/api/meta');
    const items = meta.data.templates.fire.items.map((label) => ({
      label,
      result: label.startsWith('Extinguishers') ? 'fail' : 'pass',
      note: label.startsWith('Extinguishers') ? 'Gauge in the red.' : '',
    }));
    const inspection = await send(base, '/api/inspections', {
      method: 'POST',
      body: {
        template: 'fire',
        area: 'Warehouse aisle C',
        inspector: 'Yusuf Darwish',
        inspectedOn: riyadhDate(0),
        items,
      },
    });
    assert.equal(inspection.status, 201);
    assert.equal(inspection.data.status, 'actions_required');

    const action = await send(base, '/api/actions', {
      method: 'POST',
      body: {
        title: 'Swap the warehouse extinguisher',
        source: inspection.data.ref,
        owner: 'Yusuf Darwish',
        dueOn: riyadhDate(-1),
        priority: 'high',
      },
    });
    assert.equal(action.data.overdue, true);
    const closed = await send(base, `/api/actions/${action.data.id}`, {
      method: 'PATCH',
      body: { status: 'closed', note: 'Charged extinguisher hung and the old one sent for refill.' },
    });
    assert.equal(closed.data.overdue, false);
    assert.equal(closed.data.status, 'closed');

    const hours = await send(base, '/api/settings', {
      method: 'PATCH',
      body: { hoursWorked: 200000 },
    });
    assert.equal(hours.status, 200);
    assert.equal(hours.data.trir, 1);

    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /HSE Ledger/);
    const missing = await send(base, '/api/does-not-exist');
    assert.equal(missing.status, 404);
  });
});
