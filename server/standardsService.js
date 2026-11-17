import { insertRow } from "./db.js";
import { emptyFilter, HttpError, nowIso, reqDate, reqId, reqText, today } from "./domain.js";
import { getAuditTemplate, listAuditTemplates, templateItems } from "./auditTemplates.js";
import { buildJsaDraftFromStandard, getStandard, listStandards } from "./standardsLibrary.js";
import {
  addEvent,
  createAudit,
  createJsa,
  getAudit,
  getJsa,
  listDepartments,
  listFindings,
  person,
  sharedPlace,
  withTx,
} from "./records.js";

export function standardsCatalog() {
  return { items: listStandards() };
}

export function previewAutoJsa(orgId, jobId) {
  const draft = buildJsaDraftFromStandard(orgId, jobId);
  if (!draft) throw new HttpError(404, "Standard job not found");
  return draft;
}

export function autoGenerateJsa(db, body) {
  const orgId = reqText(body.standardOrg, "Standard organization", 40).toLowerCase();
  const jobId = reqText(body.jobId, "Standard job", 80);
  const draft = buildJsaDraftFromStandard(orgId, jobId);
  if (!draft) throw new HttpError(404, "Standard job not found");

  const preparedBy = reqId(body.preparedBy, "Prepared by");
  person(db, preparedBy, "Prepared by");
  const { siteId, departmentId } = sharedPlace(db, body);
  const validUntil = body.validUntil ? reqDate(body.validUntil, "Valid until") : defaultValidUntil();
  const jobTitle = body.jobTitle ? reqText(body.jobTitle, "Job title", 160) : draft.jobTitle;
  const taskDescription = body.taskDescription
    ? reqText(body.taskDescription, "Task description")
    : draft.taskDescription;
  const ppe = body.ppe != null ? String(body.ppe) : draft.ppe;

  const created = createJsa(db, {
    jobTitle,
    siteId,
    departmentId,
    preparedBy,
    taskDescription,
    ppe,
    validUntil,
    steps: draft.steps,
  });

  const refs = draft.standardRefs.join("; ");
  const org = getStandard(orgId);
  db.prepare(
    `UPDATE jsas
     SET standard_org = ?, standard_job = ?, standard_refs = ?, generated_from_standard = 1
     WHERE id = ?`,
  ).run(org?.name || orgId, draft.jobId, refs, created.id);

  return getJsa(db, created.id);
}

function defaultValidUntil() {
  const [year, month, day] = today().split("-").map(Number);
  return new Date(Date.UTC(year + 1, month - 1, day)).toISOString().slice(0, 10);
}

export function auditTemplateCatalog(db) {
  const departments = listDepartments(db);
  return {
    items: listAuditTemplates().map((template) => {
      const match = departments.find((department) => department.name === template.departmentName);
      return {
        ...template,
        departmentId: match?.id ?? null,
      };
    }),
  };
}

export function createDepartmentAudit(db, body) {
  const departments = listDepartments(db);
  let departmentId = body.departmentId ? Number(body.departmentId) : null;
  let departmentName = body.departmentName ? String(body.departmentName).trim() : "";
  if (departmentId) {
    const found = departments.find((department) => department.id === departmentId);
    if (!found) throw new HttpError(400, "Unknown department");
    departmentName = found.name;
  } else if (departmentName) {
    const found = departments.find(
      (department) => department.name.toLowerCase() === departmentName.toLowerCase(),
    );
    if (!found) throw new HttpError(400, "Unknown department");
    departmentId = found.id;
    departmentName = found.name;
  } else {
    throw new HttpError(400, "Choose a department");
  }

  const template = getAuditTemplate(departmentName);
  if (!template) throw new HttpError(404, `No internal audit template is saved for ${departmentName}`);

  const leadAuditor = reqId(body.leadAuditor, "Lead auditor");
  person(db, leadAuditor, "Lead auditor");
  const { siteId } = sharedPlace(db, { ...body, departmentId });
  const scheduledDate = body.scheduledDate ? reqDate(body.scheduledDate, "Scheduled date") : today();
  const title =
    body.title && String(body.title).trim()
      ? reqText(body.title, "Title", 160)
      : `Internal audit — ${departmentName}`;

  const audit = createAudit(db, {
    title,
    auditType: "internal",
    siteId,
    departmentId,
    leadAuditor,
    scheduledDate,
    scope: body.scope || `${template.focus} Checklist tailored for ${departmentName}.`,
  });

  const items = templateItems(departmentName);
  withTx(db, () => {
    for (const item of items) {
      insertRow(db, "audit_checklist_items", {
        audit_id: audit.id,
        item_no: item.itemNo,
        section: item.section,
        prompt: item.prompt,
        result: "pending",
        note: "",
      });
    }
    db.prepare("UPDATE audits SET template_department = ? WHERE id = ?").run(departmentName, audit.id);
  });

  return getAuditReport(db, audit.id);
}

export function scoreAuditChecklist(db, auditId, body) {
  const audit = getAudit(db, auditId);
  if (!audit) throw new HttpError(404, "Audit not found");
  if (!Array.isArray(body.items) || body.items.length < 1) {
    throw new HttpError(400, "Checklist results are required");
  }
  const actorId = reqId(body.actorId, "Scored by");
  person(db, actorId, "Scored by");

  const allowed = new Set(["pending", "conform", "minor", "major", "na"]);
  const existing = db.prepare("SELECT id, item_no FROM audit_checklist_items WHERE audit_id = ?").all(auditId);
  if (!existing.length) throw new HttpError(400, "This audit has no department checklist");

  withTx(db, () => {
    for (const item of body.items) {
      const id = Number(item.id);
      const row = existing.find((entry) => entry.id === id);
      if (!row) throw new HttpError(400, "Unknown checklist item");
      const result = String(item.result || "");
      if (!allowed.has(result)) throw new HttpError(400, `Invalid result for item ${row.item_no}`);
      const note = item.note == null ? "" : String(item.note).trim().slice(0, 1000);
      db.prepare("UPDATE audit_checklist_items SET result = ?, note = ? WHERE id = ? AND audit_id = ?").run(
        result,
        note,
        id,
        auditId,
      );
    }
    const score = checklistScore(db, auditId);
    db.prepare("UPDATE audits SET score = ?, updated_at = ? WHERE id = ?").run(score, nowIso(), auditId);
    addEvent(db, "audit", auditId, audit.status, audit.status, actorId, "Department checklist scored", nowIso());
  });

  return getAuditReport(db, auditId);
}

function checklistScore(db, auditId) {
  const rows = db.prepare("SELECT result FROM audit_checklist_items WHERE audit_id = ?").all(auditId);
  const rated = rows.filter((row) => row.result !== "pending" && row.result !== "na");
  if (!rated.length) return null;
  const points = rated.reduce((sum, row) => {
    if (row.result === "conform") return sum + 100;
    if (row.result === "minor") return sum + 60;
    if (row.result === "major") return sum + 0;
    return sum;
  }, 0);
  return Math.round(points / rated.length);
}

export function getAuditReport(db, auditId) {
  const audit = getAudit(db, auditId);
  if (!audit) return null;
  const checklist = db
    .prepare(
      `SELECT id, item_no AS itemNo, section, prompt, result, note
       FROM audit_checklist_items
       WHERE audit_id = ?
       ORDER BY item_no`,
    )
    .all(auditId);
  const findings = listFindings(db, emptyFilter({ auditId }));
  const template = audit.templateDepartment
    ? getAuditTemplate(audit.templateDepartment)
    : getAuditTemplate(audit.departmentName);
  const summary = {
    conform: checklist.filter((item) => item.result === "conform").length,
    minor: checklist.filter((item) => item.result === "minor").length,
    major: checklist.filter((item) => item.result === "major").length,
    na: checklist.filter((item) => item.result === "na").length,
    pending: checklist.filter((item) => item.result === "pending").length,
  };

  return {
    audit,
    departmentName: audit.templateDepartment || audit.departmentName,
    focus: template?.focus || "Internal audit report for this department.",
    checklist,
    summary,
    findings,
    score: audit.score,
    generatedOn: today(),
    reportTitle: `Internal audit report — ${audit.templateDepartment || audit.departmentName}`,
  };
}

export function listDepartmentAuditReports(db) {
  const rows = db
    .prepare(
      `SELECT a.id, a.reference, a.title, a.status, a.scheduled_date AS scheduledDate,
              a.score, a.template_department AS templateDepartment,
              d.name AS departmentName, s.name AS siteName,
              (SELECT COUNT(*) FROM audit_checklist_items c WHERE c.audit_id = a.id) AS checklistCount,
              (SELECT COUNT(*) FROM findings f WHERE f.audit_id = a.id) AS findingCount
       FROM audits a
       JOIN departments d ON d.id = a.department_id
       JOIN sites s ON s.id = a.site_id
       WHERE a.audit_type = 'internal'
         AND (
           IFNULL(a.template_department, '') != ''
           OR EXISTS (SELECT 1 FROM audit_checklist_items c WHERE c.audit_id = a.id)
         )
       ORDER BY a.scheduled_date DESC, a.id DESC`,
    )
    .all();
  return { items: rows };
}
