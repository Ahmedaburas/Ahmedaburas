import { filterFromQuery } from "./domain.js";
import { openDatabase } from "./db.js";
import { buildKpis } from "./kpi.js";
import { createNearMiss, listActions, listAudits, listFindings, listIncidents, listJsas, listNearMisses, listPermits, listRisks, transition } from "./records.js";

process.env.HSE_DB = process.env.HSE_DB || ":memory:";

const lists = {
  "/near-misses": listNearMisses,
  "/incidents": listIncidents,
  "/audits": listAudits,
  "/findings": listFindings,
  "/permits": listPermits,
  "/jsa": listJsas,
  "/risks": listRisks,
  "/actions": listActions,
};

function countHref(db, href) {
  const url = new URL(href, "http://local");
  const list = lists[url.pathname];
  if (!list) throw new Error(`No list for ${href}`);
  const query = Object.fromEntries(url.searchParams.entries());
  return list(db, filterFromQuery(query)).length;
}

function walk(node, issues, trail) {
  if (!node || typeof node !== "object") return;
  if (typeof node.href === "string" && typeof node.count === "number") {
    const actual = countHref(issues.db, node.href);
    if (actual !== node.count) {
      issues.rows.push({ trail, href: node.href, count: node.count, actual });
    }
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, issues, `${trail}[${index}]`));
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "db") continue;
    walk(value, issues, trail ? `${trail}.${key}` : key);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function headline(kpi, id) {
  return kpi.headlines.find((item) => item.id === id);
}

function sumMetric(rows, key) {
  return rows.reduce((total, row) => total + row.metrics.find((metric) => metric.key === key).count, 0);
}

const db = openDatabase();
const failures = [];

for (const query of [{}, { siteId: "1" }, { departmentId: "2" }, { from: "2026-06-01", to: "2026-08-31", siteId: "2" }]) {
  const kpi = buildKpis(db, query);
  const issues = { db, rows: [] };
  walk(kpi, issues, "");
  for (const row of issues.rows) failures.push({ query, ...row });

  const nm = headline(kpi, "near-misses").count;
  const inc = headline(kpi, "incidents").count;
  assert(sumMetric(kpi.trend.months, "nearMisses") === nm, "trend near misses drifted");
  assert(sumMetric(kpi.trend.months, "incidents") === inc, "trend incidents drifted");
  assert(kpi.severity.nearMisses.rows.reduce((t, r) => t + r.count, 0) === nm, "near-miss severity drifted");
  assert(kpi.severity.incidents.rows.reduce((t, r) => t + r.count, 0) === inc, "incident severity drifted");
  assert(kpi.severity.findings.rows.reduce((t, r) => t + r.count, 0) === headline(kpi, "open-findings").count, "finding severity drifted");
  assert(
    kpi.severity.risks.rows.filter((row) => row.id === "high" || row.id === "critical").reduce((t, r) => t + r.count, 0) ===
      headline(kpi, "elevated-risks").count,
    "elevated risks drifted",
  );
  if (!query.siteId) {
    assert(sumMetric(kpi.bySite.rows, "nearMisses") === nm, "site near misses drifted");
    assert(sumMetric(kpi.bySite.rows, "incidents") === inc, "site incidents drifted");
    assert(sumMetric(kpi.bySite.rows, "openActions") === headline(kpi, "open-actions").count, "site actions drifted");
  }
  if (!query.departmentId) {
    assert(sumMetric(kpi.byDepartment.rows, "nearMisses") === nm, "department near misses drifted");
    assert(sumMetric(kpi.byDepartment.rows, "incidents") === inc, "department incidents drifted");
  }
  assert(kpi.statusBoards.audits.rows.reduce((t, r) => t + r.count, 0) === headline(kpi, "audits").count, "audit statuses drifted");
}

const base = buildKpis(db, {});
const expect = {
  "near-misses": 22,
  incidents: 9,
  audits: 6,
  "open-actions": 14,
  "overdue-actions": 6,
  "overdue-permits": 3,
  "open-findings": 7,
  "elevated-risks": 4,
  "risk-review": 2,
  "jsa-stale": 2,
};
for (const [id, count] of Object.entries(expect)) {
  const actual = headline(base, id).count;
  if (actual !== count) failures.push({ id, expected: count, actual });
}
if (headline(base, "trir").display !== "0.89") failures.push({ trir: headline(base, "trir").display });
if (headline(base, "ltir").display !== "0.35") failures.push({ ltir: headline(base, "ltir").display });
if (headline(base, "proactive-share").display !== "71%") failures.push({ share: headline(base, "proactive-share").display });
if (headline(base, "nm-ratio").display !== "2.4") failures.push({ ratio: headline(base, "nm-ratio").display });
if (headline(base, "closure").display !== "44%") failures.push({ closure: headline(base, "closure").display });

const created = createNearMiss(db, {
  title: "Check record for a loose hose",
  description: "A hose was found unclipped during the self-check.",
  siteId: 1,
  departmentId: 1,
  reportedBy: 3,
  occurredAt: "2026-11-12",
  locationDetail: "Unit",
  category: "equipment",
  severity: "low",
  potentialConsequence: "Trip",
  immediateAction: "Clipped the hose",
  status: "submitted",
});
assert(created.reference.startsWith("NM-2026-"), "reference not generated");
const moved = transition(db, "near_miss", created.id, { status: "under_review", actorId: 5, note: "HSE review started" });
assert(moved.status === "under_review", "status did not move");
assert(moved.events.length === 2, "timeline missing the status move");
const after = buildKpis(db, {});
assert(headline(after, "near-misses").count === 23, "new near miss did not reach the dashboard");

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log("KPI links match the lists, and a created near miss moves status.");
