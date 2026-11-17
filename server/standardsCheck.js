import assert from "node:assert/strict";
import { openDatabase } from "./db.js";
import {
  auditTemplateCatalog,
  autoGenerateJsa,
  createDepartmentAudit,
  getAuditReport,
  previewAutoJsa,
  scoreAuditChecklist,
  standardsCatalog,
} from "./standardsService.js";

const db = openDatabase();
const people = db.prepare("SELECT id FROM people LIMIT 1").get();
const site = db.prepare("SELECT id FROM sites LIMIT 1").get();
const operations = db.prepare("SELECT id FROM departments WHERE name = 'Operations'").get();

assert.ok(people && site && operations, "seed data missing");

const standards = standardsCatalog();
assert.equal(standards.items.length, 3);
assert.ok(standards.items.some((item) => item.id === "aramco"));
assert.ok(standards.items.some((item) => item.id === "sabic"));
assert.ok(standards.items.some((item) => item.id === "maaden"));

const preview = previewAutoJsa("aramco", "hot_work");
assert.match(preview.jobTitle, /Hot work/i);
assert.ok(preview.steps.length >= 3);

const jsa = autoGenerateJsa(db, {
  standardOrg: "aramco",
  jobId: "hot_work",
  siteId: site.id,
  departmentId: operations.id,
  preparedBy: people.id,
});
assert.equal(jsa.generatedFromStandard, 1);
assert.match(jsa.standardOrg, /Aramco/i);
assert.ok(jsa.steps.length >= 3);

const templates = auditTemplateCatalog(db);
assert.ok(templates.items.some((item) => item.departmentName === "Operations"));

const report = createDepartmentAudit(db, {
  departmentId: operations.id,
  siteId: site.id,
  leadAuditor: people.id,
});
assert.match(report.reportTitle, /Operations/);
assert.equal(report.checklist.length, 6);
assert.equal(report.summary.pending, 6);

const scored = scoreAuditChecklist(db, report.audit.id, {
  actorId: people.id,
  items: report.checklist.map((item, index) => ({
    id: item.id,
    result: index === 0 ? "major" : "conform",
    note: index === 0 ? "Barrier missing at bay entrance" : "",
  })),
});
assert.equal(scored.summary.conform, 5);
assert.equal(scored.summary.major, 1);
assert.equal(scored.score, 83);

const reloaded = getAuditReport(db, report.audit.id);
assert.equal(reloaded.score, 83);

console.log("standards and department audit checks passed");
db.close();
