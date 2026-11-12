import { filterFromQuery } from "./domain.js";
import { openDatabase } from "./db.js";
import { buildKpis } from "./kpi.js";
import { createNearMiss, listActions, listAudits, listFindings, listIncidents, listJsas, listNearMisses, listPermits, listRisks, transition } from "./records.js";
import {
  alertSignature,
  scoreHumidity,
  scoreRain,
  scoreVisibility,
  scoreWindKmh,
  scoreWbgt,
  snapshotForTests,
} from "./weather.js";
import * as weatherAdmin from "./weatherAdmin.js";
import { formatWeatherAlert, safetyInstructions, shouldAutoNotify } from "./weatherNotify.js";

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
if (headline(base, "trir").display !== "0.95") failures.push({ trir: headline(base, "trir").display });
if (headline(base, "ltir").display !== "0.38") failures.push({ ltir: headline(base, "ltir").display });
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

assert(scoreWindKmh(50) === "stop", "wind stop threshold");
assert(scoreWindKmh(35) === "warn", "wind warn threshold");
assert(scoreWbgt(34) === "high", "wbgt high threshold");
assert(scoreVisibility(150) === "stop", "visibility stop threshold");
assert(scoreHumidity(80) === "warn", "humidity warn threshold");
assert(scoreRain(1.2, 61, false) === "safe", "light rain stays inside the SOP-59 threshold");
assert(scoreRain(2.5, 63, false) === "warn", "moderate rain exceeds the SOP-59 threshold");
const calm = snapshotForTests({
  source: "test",
  condition: "clear",
  windKmh: 10,
  rainMmH: 0,
  tempC: 22,
  feelsC: 22,
  rh: 50,
  pressureHpa: 1020,
  visibilityM: 10000,
  weatherCode: 0,
  hasThunder: false,
});
assert(calm.tiles.find((tile) => tile.id === "pressure").level === "reference", "pressure is reference only");
assert(!shouldAutoNotify(null, calm), "safe conditions should not notify");
const windStop = snapshotForTests({ ...calm.raw, source: "test", condition: "wind", windKmh: 50, hasThunder: false, weatherCode: 0 });
assert(shouldAutoNotify(null, windStop), "wind over 48 km/h should notify");
assert(!shouldAutoNotify(alertSignature(windStop), windStop), "the same wind exceedance should not repeat");
assert(!shouldAutoNotify(alertSignature(windStop), calm), "returning inside the thresholds should not notify");
const humid = snapshotForTests({
  ...calm.raw,
  source: "test",
  condition: "humid",
  rh: 96,
  hasThunder: false,
  weatherCode: 0,
});
assert(!shouldAutoNotify(alertSignature(calm), humid), "humidity alone should not notify");
const hot = snapshotForTests({
  ...calm.raw,
  source: "test",
  condition: "hot",
  tempC: 34,
  feelsC: 34,
  rh: 10,
  hasThunder: false,
  weatherCode: 0,
});
assert(hot.tiles.find((tile) => tile.id === "wbgt").level === "safe", "this heat case keeps WBGT inside its threshold");
assert(shouldAutoNotify(alertSignature(calm), hot), "temperature at 34°C should notify");

const windText = formatWeatherAlert(windStop);
assert(windText.includes("STOP at 48 km/h"), "wind stop instruction uses the SOP-59 table");
assert(windText.includes("Stop outdoor work now"), "wind stop instruction tells crews to stop");
assert(!windText.includes("2.5 mm/h"), "a wind-only alert does not add a rain instruction");
assert(safetyInstructions(humid).length === 0, "humidity does not add a safety instruction");
const moderateRain = snapshotForTests({
  ...calm.raw,
  source: "test",
  condition: "rain",
  rainMmH: 3,
  weatherCode: 63,
  hasThunder: false,
});
assert(formatWeatherAlert(moderateRain).includes("WARN at moderate rain (2.5 mm/h)"), "moderate rain instruction");
const heavyRain = snapshotForTests({
  ...calm.raw,
  source: "test",
  condition: "rain",
  rainMmH: 8,
  weatherCode: 65,
  hasThunder: false,
});
assert(formatWeatherAlert(heavyRain).includes("STOP at heavy rain (7.6 mm/h)"), "heavy rain instruction");
assert(formatWeatherAlert(hot).includes("CAUTION at 33°C"), "temperature caution instruction");
const highHeat = snapshotForTests({
  ...calm.raw,
  source: "test",
  condition: "hot",
  tempC: 41,
  feelsC: 41,
  rh: 5,
  hasThunder: false,
  weatherCode: 0,
});
assert(formatWeatherAlert(highHeat).includes("HIGH at 40°C"), "temperature high instruction");
const extremeHeat = snapshotForTests({
  ...calm.raw,
  source: "test",
  condition: "extreme",
  tempC: 46,
  feelsC: 48,
  rh: 5,
  hasThunder: false,
  weatherCode: 0,
});
assert(formatWeatherAlert(extremeHeat).includes("EXTREME at 45°C"), "temperature extreme instruction");
const wbgtCaution = snapshotForTests({
  ...calm.raw,
  source: "test",
  condition: "humid heat",
  tempC: 30,
  feelsC: 32,
  rh: 50,
  hasThunder: false,
  weatherCode: 0,
});
assert(wbgtCaution.tiles.find((tile) => tile.id === "temperature").level === "ok", "WBGT caution case keeps air temperature inside its band");
assert(formatWeatherAlert(wbgtCaution).includes("CAUTION at 28°C"), "WBGT caution instruction");
const wbgtStop = snapshotForTests({
  ...calm.raw,
  source: "test",
  condition: "heat stress",
  tempC: 32,
  feelsC: 36,
  rh: 70,
  hasThunder: false,
  weatherCode: 0,
});
assert(wbgtStop.tiles.find((tile) => tile.id === "wbgt").level === "stop", "WBGT stop case");
assert(formatWeatherAlert(wbgtStop).includes("STOP at 35°C"), "WBGT stop instruction");
const both = snapshotForTests({
  ...calm.raw,
  source: "test",
  condition: "storm",
  windKmh: 36,
  rainMmH: 8,
  weatherCode: 65,
  hasThunder: false,
});
const bothText = formatWeatherAlert(both);
assert(bothText.indexOf("WARN at 32 km/h") < bothText.indexOf("STOP at heavy rain"), "each exceeded threshold gets its own instruction");

const notifyBefore = weatherAdmin.listNotifications(db).length;
db.prepare("UPDATE weather_settings SET auto_notify = 0, last_overall_level = ?").run("safe");
process.env.HSE_WEATHER_FIXTURE = JSON.stringify({
  source: "fixture",
  condition: "wind",
  fetchedAt: new Date().toISOString(),
  windKmh: 50,
  rainMmH: 0,
  tempC: 22,
  feelsC: 22,
  rh: 50,
  pressureHpa: 1015,
  visibilityM: 10000,
  weatherCode: 0,
  hasThunder: false,
});
await weatherAdmin.getWeather(db, { force: true });
const notifyAfter = weatherAdmin.listNotifications(db).length;
assert(notifyBefore === notifyAfter, "auto-notify off should not log sends");
delete process.env.HSE_WEATHER_FIXTURE;
weatherAdmin.createContact(db, {
  name: "Weather check",
  email: "weather-check@example.com",
  notifyEmail: true,
});
const manual = await weatherAdmin.notifyNow(db, {});
assert(manual.sent === true && manual.log.length >= 1, "manual notify should send when wind exceeds 48 km/h");
process.env.HSE_WEATHER_FIXTURE = JSON.stringify({
  source: "fixture",
  condition: "clear",
  fetchedAt: new Date().toISOString(),
  windKmh: 10,
  rainMmH: 1,
  tempC: 22,
  feelsC: 22,
  rh: 96,
  pressureHpa: 1010,
  visibilityM: 100,
  weatherCode: 61,
  hasThunder: true,
});
db.prepare("UPDATE weather_settings SET auto_notify = 1").run();
const inside = await weatherAdmin.getWeather(db, { force: true });
assert(inside.notified === false, "lightning, humidity, and light rain should not send an alert");
const blocked = await weatherAdmin.notifyNow(db, {});
assert(blocked.sent === false, "manual notify should stay quiet inside wind, rain, temperature, and WBGT thresholds");
delete process.env.HSE_WEATHER_FIXTURE;

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log("KPI links match the lists, weather SOP-59 checks pass, and a created near miss moves status.");
