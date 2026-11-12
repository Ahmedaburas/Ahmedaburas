import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { openDatabase } from "./db.js";
import {
  ENUMS,
  HttpError,
  STATUS_LABELS,
  TRANSITIONS,
  filterFromQuery,
  today,
} from "./domain.js";
import { buildKpis } from "./kpi.js";
import * as records from "./records.js";
import * as weatherAdmin from "./weatherAdmin.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const distIndex = path.join(distDir, "index.html");
const db = openDatabase();
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

function route(fn) {
  return (req, res, next) => {
    try {
      fn(req, res);
    } catch (error) {
      next(error);
    }
  };
}

function idOf(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
}

function sendList(res, items) {
  res.json({ items, total: items.length });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get(
  "/api/meta",
  route((_req, res) => {
    res.json({
      today: today(),
      sites: records.listSites(db),
      departments: records.listDepartments(db),
      people: records.listPeople(db),
      labels: { status: STATUS_LABELS },
      transitions: TRANSITIONS,
      enums: ENUMS,
    });
  }),
);

app.get(
  "/api/kpis",
  route((req, res) => {
    res.json(buildKpis(db, req.query));
  }),
);

app.get(
  "/api/weather",
  route(async (req, res) => {
    const force = req.query.force === "1" || req.query.force === "true";
    res.json(await weatherAdmin.getWeather(db, { force }));
  }),
);

app.get(
  "/api/weather/settings",
  route((_req, res) => {
    res.json(weatherAdmin.getSettings(db));
  }),
);

app.put(
  "/api/weather/settings",
  route((req, res) => {
    res.json(weatherAdmin.updateSettings(db, req.body || {}));
  }),
);

app.get(
  "/api/weather/contacts",
  route((_req, res) => {
    sendList(res, weatherAdmin.listContacts(db));
  }),
);

app.post(
  "/api/weather/contacts",
  route((req, res) => {
    try {
      res.status(201).json(weatherAdmin.createContact(db, req.body || {}));
    } catch (error) {
      throw new HttpError(400, error.message);
    }
  }),
);

app.delete(
  "/api/weather/contacts/:id",
  route((req, res) => {
    weatherAdmin.deleteContact(db, idOf(req));
    res.status(204).end();
  }),
);

app.get(
  "/api/weather/groups",
  route((_req, res) => {
    sendList(res, weatherAdmin.listGroups(db));
  }),
);

app.post(
  "/api/weather/groups",
  route((req, res) => {
    try {
      res.status(201).json(weatherAdmin.createGroup(db, req.body || {}));
    } catch (error) {
      throw new HttpError(400, error.message);
    }
  }),
);

app.delete(
  "/api/weather/groups/:id",
  route((req, res) => {
    weatherAdmin.deleteGroup(db, idOf(req));
    res.status(204).end();
  }),
);

app.post(
  "/api/weather/notify",
  route(async (req, res) => {
    const groupIds = Array.isArray(req.body?.groupIds) ? req.body.groupIds.map(Number) : [];
    res.json(await weatherAdmin.notifyNow(db, { groupIds }));
  }),
);

app.get(
  "/api/weather/notifications",
  route((req, res) => {
    sendList(res, weatherAdmin.listNotifications(db, Number(req.query.limit) || 20));
  }),
);

const collections = [
  ["/api/near-misses", "near_miss", records.listNearMisses, records.getNearMiss, records.createNearMiss],
  ["/api/incidents", "incident", records.listIncidents, records.getIncident, records.createIncident],
  ["/api/audits", "audit", records.listAudits, records.getAudit, records.createAudit],
  ["/api/findings", "finding", records.listFindings, records.getFinding, null],
  ["/api/permits", "permit", records.listPermits, records.getPermit, records.createPermit],
  ["/api/jsa", "jsa", records.listJsas, records.getJsa, records.createJsa],
  ["/api/risks", "risk", records.listRisks, records.getRisk, records.createRisk],
  ["/api/actions", "action", records.listActions, records.getAction, records.createAction],
];

for (const [base, entity, list, get, create] of collections) {
  app.get(
    base,
    route((req, res) => {
      sendList(res, list(db, filterFromQuery(req.query)));
    }),
  );
  app.get(
    `${base}/:id`,
    route((req, res) => {
      const record = get(db, idOf(req));
      if (!record) throw new HttpError(404, "Record not found");
      res.json(record);
    }),
  );
  app.post(
    `${base}/:id/status`,
    route((req, res) => {
      res.json(records.transition(db, entity, idOf(req), req.body || {}));
    }),
  );
  if (create) {
    app.post(
      base,
      route((req, res) => {
        res.status(201).json(create(db, req.body || {}));
      }),
    );
  }
}

app.post(
  "/api/audits/:id/findings",
  route((req, res) => {
    res.status(201).json(records.createFinding(db, idOf(req), req.body || {}));
  }),
);

app.post(
  "/api/incidents/:id/cause",
  route((req, res) => {
    res.json(records.updateIncidentCause(db, idOf(req), req.body || {}));
  }),
);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

if (fs.existsSync(distIndex)) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(distIndex);
  });
}

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? "Something went wrong" : error.message });
});

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || "127.0.0.1";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  weatherAdmin.startWeatherPoller(db);
  app.listen(port, host, () => {
    console.log(`HSE platform API on http://${host}:${port}`);
  });
}

export { app };
