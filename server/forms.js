import {
  ENUMS,
  HttpError,
  camel,
  clipRange,
  defaultFrom,
  eachMonth,
  eachQuarter,
  eachYear,
  emptyFilter,
  link,
  monthLabel,
  monthRange,
  nowIso,
  occurredDay,
  quarterLabel,
  quarterRange,
  resolvePeriod,
  today,
  yearRange,
} from "./domain.js";
import { insertRow } from "./db.js";
import { INMA_NEAR_MISS_FORM } from "./formConfig.js";
import { listDepartments, listNearMisses, listSites } from "./records.js";
import { workbookBuffer } from "./xlsx.js";

export { INMA_NEAR_MISS_FORM };

const META_TTL_MS = 5 * 60 * 1000;
const CATEGORY_ENUM = new Map(ENUMS.nearMissCategory);
const SEVERITY_ENUM = new Map(ENUMS.nearMissSeverity);

function settingsRow(db) {
  return db.prepare("SELECT * FROM form_settings WHERE id = 1").get();
}

export function getFormSettings(db) {
  return camel(settingsRow(db));
}

function saveSettings(db, patch) {
  const current = settingsRow(db);
  db.prepare(
    `UPDATE form_settings SET
      title = @title,
      description = @description,
      status = @status,
      public_url = @public_url,
      analysis_url = @analysis_url,
      microsoft_row_count = @microsoft_row_count,
      last_fetched_at = @last_fetched_at,
      last_sync_at = @last_sync_at,
      last_sync_error = @last_sync_error,
      last_sync_source = @last_sync_source
     WHERE id = 1`,
  ).run({
    title: patch.title ?? current.title,
    description: patch.description ?? current.description,
    status: patch.status ?? current.status,
    public_url: patch.publicUrl ?? current.public_url,
    analysis_url: patch.analysisUrl ?? current.analysis_url,
    microsoft_row_count: patch.microsoftRowCount ?? current.microsoft_row_count,
    last_fetched_at: patch.lastFetchedAt ?? current.last_fetched_at,
    last_sync_at: patch.lastSyncAt ?? current.last_sync_at,
    last_sync_error: patch.lastSyncError ?? current.last_sync_error,
    last_sync_source: patch.lastSyncSource ?? current.last_sync_source,
  });
  return getFormSettings(db);
}

function runtimeFormUrl(form = INMA_NEAR_MISS_FORM) {
  return `https://forms.office.com/formapi/api/${form.tenantId}/groups/${form.groupId}/light/runtimeForms('${form.formId}')?$expand=questions($expand=choices)`;
}

function ownerResponsesUrl(form = INMA_NEAR_MISS_FORM) {
  return `https://forms.office.com/formapi/api/${form.tenantId}/groups/${form.groupId}/forms('${form.formId}')/responses?$top=5000`;
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "InmaHSE/1.0", ...headers },
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 200) };
    }
  }
  return { ok: response.ok, status: response.status, data };
}

export async function fetchFormMeta() {
  if (process.env.HSE_FORMS_FIXTURE) {
    return JSON.parse(process.env.HSE_FORMS_FIXTURE);
  }
  const { ok, status, data } = await fetchJson(runtimeFormUrl());
  if (!ok || !data) throw new HttpError(502, `Microsoft Forms did not return the near-miss form (${status}).`);
  return data;
}

export async function refreshFormMeta(db, { force = false } = {}) {
  const current = getFormSettings(db);
  if (!force && current.lastFetchedAt && Date.now() - Date.parse(current.lastFetchedAt) < META_TTL_MS) {
    return current;
  }
  const meta = await fetchFormMeta();
  return saveSettings(db, {
    title: String(meta.title || current.title || "Near miss Reporting Form").trim(),
    description: String(meta.description || current.description || ""),
    status: String(meta.status || "Active"),
    publicUrl: INMA_NEAR_MISS_FORM.publicUrl,
    analysisUrl: INMA_NEAR_MISS_FORM.analysisUrl,
    microsoftRowCount: Number(meta.rowCount ?? current.microsoftRowCount ?? 0),
    lastFetchedAt: nowIso(),
  });
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLike(key, needles) {
  const text = normalizeKey(key);
  return needles.some((needle) => text.includes(needle));
}

function firstMatch(entries, needles) {
  for (const [key, value] of entries) {
    if (value && looksLike(key, needles)) return String(value).trim();
  }
  return "";
}

function mapCategory(value) {
  const text = normalizeKey(value);
  if (!text) return "";
  if (CATEGORY_ENUM.has(text.replace(/\s/g, "_"))) return text.replace(/\s/g, "_");
  if (/(slip|trip|fall on)/.test(text)) return "slip_trip";
  if (/(drop|falling object)/.test(text)) return "dropped_object";
  if (/(isolat|loto|energy)/.test(text)) return "isolation";
  if (/(vehicle|forklift|mobile plant|crane)/.test(text)) return "vehicle";
  if (/(chemical|spill|fume|gas)/.test(text)) return "chemical";
  if (/(height|scaffold|ladder)/.test(text)) return "height";
  if (/(housekeep|house keeping)/.test(text)) return "housekeeping";
  if (/(equipment|machine|tool|hose)/.test(text)) return "equipment";
  if (/(environment|waste|dust)/.test(text)) return "environmental";
  if (/(procedure|permit|process)/.test(text)) return "procedure";
  return text.slice(0, 40);
}

function mapSeverity(value) {
  const text = normalizeKey(value);
  if (!text) return "";
  if (SEVERITY_ENUM.has(text)) return text;
  if (/(critical|extreme|catastrophic)/.test(text)) return "critical";
  if (/(high|serious|major)/.test(text)) return "high";
  if (/(medium|moderate)/.test(text)) return "medium";
  if (/(low|minor|near miss)/.test(text)) return "low";
  return text.slice(0, 40);
}

function dateOnly(value) {
  if (!value) return "";
  const text = String(value).trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
}

function parseAnswers(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return parseAnswers(JSON.parse(raw));
    } catch {
      return { Answer: raw };
    }
  }
  if (Array.isArray(raw)) {
    const out = {};
    raw.forEach((item, index) => {
      if (item == null) return;
      if (typeof item !== "object") {
        out[`Answer ${index + 1}`] = String(item);
        return;
      }
      const key = item.question || item.title || item.questionTitle || item.name || item.questionId || `Answer ${index + 1}`;
      const value = item.answer ?? item.value ?? item.text ?? item.response ?? "";
      out[String(key)] = Array.isArray(value) ? value.map((part) => part?.displayValue || part).join("; ") : value;
    });
    return out;
  }
  if (typeof raw === "object") return { ...raw };
  return { Answer: String(raw) };
}

function flattenResponse(raw) {
  const row = raw && typeof raw === "object" ? raw : {};
  const answers = parseAnswers(row.answers ?? row.questions ?? row);
  const skip = new Set([
    "id",
    "responseid",
    "response_id",
    "answers",
    "questions",
    "startdate",
    "submitdate",
    "submittedat",
    "responder",
    "email",
    "name",
  ]);
  const entries = Object.entries(answers).filter(([key]) => !skip.has(normalizeKey(key).replace(/\s/g, "")));
  const description =
    firstMatch(entries, ["what happened", "description", "near miss", "details", "event", "hazard", "comment"]) ||
    firstMatch(entries, ["title", "subject"]) ||
    Object.values(answers).find((value) => String(value).length > 20) ||
    "";
  const title =
    firstMatch(entries, ["title", "subject", "summary"]) ||
    String(description || "Near miss report").replace(/\s+/g, " ").trim().slice(0, 160);
  const submittedAt = row.submitDate || row.submittedAt || row.startDate || row.StartTime || answers["Completion time"] || answers["Start time"] || "";
  const occurredAt =
    dateOnly(firstMatch(entries, ["occurred", "date of", "when", "incident date", "event date"])) || dateOnly(submittedAt);
  return {
    responseId: String(row.id || row.responseId || row.Id || row.response_id || "").trim(),
    submittedAt: submittedAt ? new Date(Date.parse(submittedAt) || Date.now()).toISOString() : nowIso(),
    occurredAt: occurredAt || today(),
    responder: String(row.responder || row.email || answers.Email || answers.Name || firstMatch(entries, ["reporter", "name", "reported by"]) || "").trim(),
    title,
    description: String(description || title),
    location: firstMatch(entries, ["location", "area", "place", "where"]),
    siteName: firstMatch(entries, ["site", "shop", "yard", "plant"]),
    departmentName: firstMatch(entries, ["department", "section", "crew", "unit"]),
    category: mapCategory(firstMatch(entries, ["category", "type", "hazard", "classification"])),
    severity: mapSeverity(firstMatch(entries, ["severity", "potential", "risk", "rating"])),
    immediateAction: firstMatch(entries, ["immediate", "action taken", "control", "what did you do"]),
    answers,
  };
}

function uniqueResponseId(mapped, index) {
  if (mapped.responseId) return mapped.responseId;
  const stamp = `${mapped.occurredAt}|${mapped.title}|${mapped.responder}|${mapped.location}`;
  return `import-${Buffer.from(stamp).toString("base64url").slice(0, 48)}-${index}`;
}

export function upsertFormResponse(db, raw, index = 0) {
  const mapped = flattenResponse(raw);
  const responseId = uniqueResponseId(mapped, index);
  const now = nowIso();
  const existing = db.prepare("SELECT id FROM form_responses WHERE response_id = ?").get(responseId);
  const row = {
    response_id: responseId,
    submitted_at: mapped.submittedAt,
    occurred_at: mapped.occurredAt,
    responder: mapped.responder,
    title: mapped.title.slice(0, 160) || "Near miss report",
    description: mapped.description,
    location: mapped.location.slice(0, 200),
    site_name: mapped.siteName.slice(0, 160),
    department_name: mapped.departmentName.slice(0, 160),
    category: mapped.category,
    severity: mapped.severity,
    immediate_action: mapped.immediateAction,
    answers_json: JSON.stringify(mapped.answers || {}),
    source: "microsoft_forms",
    imported_at: now,
  };
  if (existing) {
    db.prepare(
      `UPDATE form_responses SET submitted_at=@submitted_at, occurred_at=@occurred_at, responder=@responder, title=@title,
        description=@description, location=@location, site_name=@site_name, department_name=@department_name,
        category=@category, severity=@severity, immediate_action=@immediate_action, answers_json=@answers_json,
        imported_at=@imported_at WHERE response_id=@response_id`,
    ).run(row);
    return { id: existing.id, created: false };
  }
  const id = insertRow(db, "form_responses", row);
  return { id, created: true };
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(text || "").replace(/^\uFEFF/, "");
  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    if (row.some((value) => String(value).trim())) rows.push(row);
    row = [];
  };
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") pushCell();
    else if (ch === "\n") {
      pushCell();
      pushRow();
    } else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) {
    pushCell();
    pushRow();
  }
  if (!rows.length) return [];
  const headers = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    return record;
  });
}

function asResponseList(payload) {
  if (payload == null) return [];
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return asResponseList(JSON.parse(trimmed));
    return parseCsv(trimmed);
  }
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.value)) return payload.value;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.responses)) return payload.responses;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (payload.form && Array.isArray(payload.form.responses)) return payload.form.responses;
  if (payload.csv) return parseCsv(payload.csv);
  if (payload.answers || payload.responseId || payload.id || payload.submitDate) return [payload];
  return [];
}

export function importFormPayload(db, payload, source = "import") {
  const list = asResponseList(payload);
  if (!list.length) throw new HttpError(400, "No near-miss form rows were found in that file.");
  let created = 0;
  let updated = 0;
  db.exec("BEGIN");
  try {
    list.forEach((item, index) => {
      const result = upsertFormResponse(db, item, index);
      if (result.created) created += 1;
      else updated += 1;
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  saveSettings(db, { lastSyncAt: nowIso(), lastSyncError: "", lastSyncSource: source });
  return { imported: list.length, created, updated, total: countFormResponses(db) };
}

function countFormResponses(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM form_responses").get().n;
}

function formAuthHeaders() {
  const token = process.env.MS_FORMS_ACCESS_TOKEN || process.env.MICROSOFT_FORMS_TOKEN;
  const cookie = process.env.MS_FORMS_COOKIE;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  return headers;
}

export async function fetchOwnerResponses() {
  if (process.env.HSE_FORMS_RESPONSES_FIXTURE) {
    return asResponseList(JSON.parse(process.env.HSE_FORMS_RESPONSES_FIXTURE));
  }
  const headers = formAuthHeaders();
  if (!headers.Authorization && !headers.Cookie) return null;
  const { ok, status, data } = await fetchJson(ownerResponsesUrl(), headers);
  if (!ok) throw new HttpError(502, `Microsoft Forms responses need owner access (${status}).`);
  return asResponseList(data);
}

export async function syncFormResponses(db) {
  const rows = await fetchOwnerResponses();
  if (rows == null) {
    saveSettings(db, {
      lastSyncAt: nowIso(),
      lastSyncError: "Microsoft Forms hides individual answers until an owner token or an Excel/CSV export is supplied.",
      lastSyncSource: "public",
    });
    return { imported: 0, created: 0, updated: 0, total: countFormResponses(db), needsAuth: true };
  }
  if (!rows.length) {
    saveSettings(db, { lastSyncAt: nowIso(), lastSyncError: "", lastSyncSource: "microsoft_forms" });
    return { imported: 0, created: 0, updated: 0, total: countFormResponses(db), needsAuth: false };
  }
  return { ...importFormPayload(db, rows, "microsoft_forms"), needsAuth: false };
}

function inPeriod(date, from, to) {
  const day = occurredDay(date);
  if (!day) return false;
  return day >= from && day <= to;
}

function chartRows(counts, labels = null) {
  return Object.entries(counts)
    .map(([id, count]) => ({
      id,
      label: labels?.get?.(id) || labels?.[id] || id,
      count,
    }))
    .filter((row) => row.count > 0 || labels)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function addCount(map, key) {
  const id = key || "unspecified";
  map[id] = (map[id] || 0) + 1;
}

export function listStoredFormResponses(db, filter = {}) {
  const clauses = [];
  const params = [];
  if (filter.from) {
    clauses.push("date(occurred_at) >= date(?)");
    params.push(filter.from);
  }
  if (filter.to) {
    clauses.push("date(occurred_at) <= date(?)");
    params.push(filter.to);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(`SELECT * FROM form_responses ${where} ORDER BY occurred_at DESC, id DESC`)
    .all(...params)
    .map((row) => camel(row));
}

function unifyFormRow(row) {
  return {
    id: `form-${row.id}`,
    source: "form",
    reference: row.responseId,
    title: row.title,
    description: row.description,
    occurredAt: row.occurredAt,
    location: row.location || row.siteName || "",
    siteName: row.siteName || row.location || "Unspecified",
    departmentName: row.departmentName || "Unspecified",
    category: row.category || "unspecified",
    severity: row.severity || "unspecified",
    responder: row.responder,
    immediateAction: row.immediateAction,
  };
}

function unifyRegisterRow(row) {
  return {
    id: `nm-${row.id}`,
    source: "register",
    reference: row.reference,
    title: row.title,
    description: row.description,
    occurredAt: row.occurredAt,
    location: row.locationDetail || row.siteName,
    siteName: row.siteName,
    departmentName: row.departmentName,
    category: row.category,
    severity: row.severity,
    responder: row.reportedByName,
    immediateAction: row.immediateAction,
  };
}

function matchScope(rows, { siteId, departmentId }, db) {
  let next = rows;
  if (siteId) {
    const site = listSites(db).find((item) => String(item.id) === String(siteId));
    if (site) {
      const needle = normalizeKey(site.name);
      next = next.filter((row) => normalizeKey(row.siteName).includes(needle) || normalizeKey(row.location).includes(needle));
    }
  }
  if (departmentId) {
    const department = listDepartments(db).find((item) => String(item.id) === String(departmentId));
    if (department) {
      const needle = normalizeKey(department.name);
      next = next.filter((row) => normalizeKey(row.departmentName).includes(needle));
    }
  }
  return next;
}

function nearMissChips(query = {}) {
  return {
    nmSeverity: query.nmSeverity ? String(query.nmSeverity) : "",
    nmCategory: query.nmCategory ? String(query.nmCategory) : "",
    nmLocation: query.nmLocation ? String(query.nmLocation) : "",
  };
}

function applyNearMissChips(rows, chips) {
  let next = rows;
  if (chips.nmSeverity) next = next.filter((row) => row.severity === chips.nmSeverity);
  if (chips.nmCategory) next = next.filter((row) => row.category === chips.nmCategory);
  if (chips.nmLocation) {
    const needle = normalizeKey(chips.nmLocation);
    next = next.filter((row) => normalizeKey(row.siteName) === needle || normalizeKey(row.location) === needle);
  }
  return next;
}

function timelineSpan(rows, period) {
  const end = today();
  const days = rows.map((row) => occurredDay(row.occurredAt)).filter(Boolean).sort();
  const first = days[0] || period.from || defaultFrom(end);
  const last = days[days.length - 1];
  const to = [end, period.to, last].filter(Boolean).sort().at(-1);
  return { from: `${first.slice(0, 7)}-01`, to };
}

function buildTimeline(rows, spanFrom, spanTo) {
  function countBetween(start, end) {
    return rows.filter((row) => inPeriod(row.occurredAt, start, end)).length;
  }
  function bucket(id, grain, label, range) {
    const click = clipRange(range, spanFrom, spanTo);
    return {
      id,
      grain,
      label,
      from: click.from,
      to: click.to,
      count: countBetween(click.from, click.to),
    };
  }
  return {
    span: { from: spanFrom, to: spanTo },
    years: eachYear(spanFrom, spanTo).map((year) => bucket(year, "year", year, yearRange(year))),
    quarters: eachQuarter(spanFrom, spanTo).map((id) => bucket(id, "quarter", quarterLabel(id), quarterRange(id))),
    months: eachMonth(spanFrom, spanTo).map((month) => bucket(month, "month", monthLabel(month), monthRange(month))),
  };
}

function selectedFromTimeline(timeline, from, to) {
  const keys = { month: "months", quarter: "quarters", year: "years" };
  for (const grain of ["month", "quarter", "year"]) {
    const row = (timeline[keys[grain]] || []).find((item) => item.from === from && item.to === to);
    if (row) return { grain: row.grain, id: row.id, label: row.label, from: row.from, to: row.to, count: row.count };
  }
  return { grain: null, id: null, label: null, from, to, count: null };
}

function buildStats(rows, from, to, { timeline, scope = {}, chips = {} } = {}) {
  const period = rows.filter((row) => inPeriod(row.occurredAt, from, to));
  const thisMonth = today().slice(0, 7);
  const byMonthMap = {};
  for (const month of eachMonth(from, to)) byMonthMap[month] = 0;
  const byCategory = {};
  const bySeverity = {};
  const byLocation = {};
  for (const row of period) {
    const month = occurredDay(row.occurredAt).slice(0, 7);
    if (month in byMonthMap) byMonthMap[month] += 1;
    addCount(byCategory, row.category);
    addCount(bySeverity, row.severity);
    addCount(byLocation, row.siteName || row.location || "Unspecified");
  }
  const highCritical = period.filter((row) => row.severity === "high" || row.severity === "critical").length;
  const dash = { from, to, siteId: scope.siteId, departmentId: scope.departmentId };
  return {
    total: rows.length,
    periodTotal: period.length,
    thisMonth: period.filter((row) => occurredDay(row.occurredAt).slice(0, 7) === thisMonth).length,
    highCritical,
    timeline,
    selected: timeline ? selectedFromTimeline(timeline, from, to) : null,
    chips,
    listHref: link("/near-misses", {
      ...dash,
      severity: chips.nmSeverity,
      category: chips.nmCategory,
    }),
    byYear: (timeline?.years || []).map((row) => ({
      id: row.id,
      label: row.label,
      count: row.count,
      from: row.from,
      to: row.to,
    })),
    byMonth: Object.entries(byMonthMap).map(([month, count]) => ({
      id: month,
      label: monthLabel(month),
      count,
    })),
    byCategory: ENUMS.nearMissCategory.map(([id, label]) => ({
      id,
      label,
      count: byCategory[id] || 0,
    })).concat(
      Object.entries(byCategory)
        .filter(([id]) => !CATEGORY_ENUM.has(id) && id !== "unspecified")
        .map(([id, count]) => ({ id, label: id, count })),
    ).concat(byCategory.unspecified ? [{ id: "unspecified", label: "Unspecified", count: byCategory.unspecified }] : []),
    bySeverity: ENUMS.nearMissSeverity.map(([id, label]) => ({
      id,
      label,
      count: bySeverity[id] || 0,
    })).concat(
      Object.entries(bySeverity)
        .filter(([id]) => !SEVERITY_ENUM.has(id) && id !== "unspecified")
        .map(([id, count]) => ({ id, label: id, count })),
    ).concat(bySeverity.unspecified ? [{ id: "unspecified", label: "Unspecified", count: bySeverity.unspecified }] : []),
    byLocation: chartRows(byLocation).slice(0, 8),
  };
}

export async function getNearMissForm(db, query = {}, { force = false } = {}) {
  let form;
  try {
    form = await refreshFormMeta(db, { force });
  } catch (error) {
    form = saveSettings(db, {
      lastFetchedAt: nowIso(),
      lastSyncError: error.message || "Microsoft Forms could not be reached.",
    });
  }
  const period = resolvePeriod(query);
  const formRows = matchScope(listStoredFormResponses(db).map(unifyFormRow), period, db);
  const registerRows = matchScope(listNearMisses(db, emptyFilter({})).map(unifyRegisterRow), period, db);
  const useForm = formRows.length > 0;
  const rows = useForm ? formRows : registerRows;
  const chips = nearMissChips(query);
  const span = timelineSpan(rows, period);
  const timeline = buildTimeline(rows, span.from, span.to);
  const periodRows = applyNearMissChips(
    rows.filter((row) => inPeriod(row.occurredAt, period.from, period.to)),
    chips,
  );
  const stats = buildStats(periodRows, period.from, period.to, { timeline, scope: period, chips });
  return {
    form: {
      ...INMA_NEAR_MISS_FORM,
      title: form.title,
      description: form.description,
      status: form.status,
      publicUrl: form.publicUrl || INMA_NEAR_MISS_FORM.publicUrl,
      analysisUrl: form.analysisUrl || INMA_NEAR_MISS_FORM.analysisUrl,
      microsoftRowCount: form.microsoftRowCount,
      syncedCount: countFormResponses(db),
      lastFetchedAt: form.lastFetchedAt,
      lastSyncAt: form.lastSyncAt,
      lastSyncError: form.lastSyncError,
      lastSyncSource: form.lastSyncSource,
      connected: true,
    },
    source: useForm ? "form" : "register",
    applied: { from: period.from, to: period.to, siteId: period.siteId, departmentId: period.departmentId },
    stats,
    recent: periodRows.slice(0, 8),
  };
}

export function exportNearMissWorkbook(db, query = {}) {
  const period = resolvePeriod(query);
  const formRows = listStoredFormResponses(db, { from: period.from, to: period.to });
  const registerRows = listNearMisses(db, emptyFilter({ from: period.from, to: period.to, siteId: period.siteId, departmentId: period.departmentId }));
  const formHeader = [
    "Response id",
    "Occurred",
    "Submitted",
    "Title",
    "Description",
    "Location",
    "Site",
    "Department",
    "Category",
    "Severity",
    "Reporter",
    "Immediate action",
  ];
  const registerHeader = [
    "Reference",
    "Occurred",
    "Title",
    "Description",
    "Site",
    "Department",
    "Location",
    "Category",
    "Severity",
    "Reported by",
    "Status",
    "Immediate action",
  ];
  const summary = [
    ["Near miss report", "Inma Steel Fabricators"],
    ["Period", `${period.from} to ${period.to}`],
    ["Microsoft Form", INMA_NEAR_MISS_FORM.publicUrl],
    ["Form rows in period", formRows.length],
    ["HSE register rows in period", registerRows.length],
  ];
  return workbookBuffer([
    { name: "Summary", rows: summary },
    {
      name: "QR form",
      rows: [
        formHeader,
        ...formRows.map((row) => [
          row.responseId,
          row.occurredAt,
          row.submittedAt,
          row.title,
          row.description,
          row.location,
          row.siteName,
          row.departmentName,
          row.category,
          row.severity,
          row.responder,
          row.immediateAction,
        ]),
      ],
    },
    {
      name: "HSE register",
      rows: [
        registerHeader,
        ...registerRows.map((row) => [
          row.reference,
          row.occurredAt,
          row.title,
          row.description,
          row.siteName,
          row.departmentName,
          row.locationDetail,
          row.category,
          row.severity,
          row.reportedByName,
          row.status,
          row.immediateAction,
        ]),
      ],
    },
  ]);
}

export function startFormsPoller(db) {
  const tick = async () => {
    try {
      await refreshFormMeta(db, { force: true });
      if (process.env.MS_FORMS_ACCESS_TOKEN || process.env.MS_FORMS_COOKIE || process.env.HSE_FORMS_RESPONSES_FIXTURE) {
        await syncFormResponses(db);
      }
    } catch (error) {
      console.warn("Near-miss form refresh failed", error.message);
    }
  };
  tick();
  return setInterval(tick, 10 * 60 * 1000);
}
