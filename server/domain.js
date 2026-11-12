export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  actions_open: "Actions open",
  closed: "Closed",
  reported: "Reported",
  investigating: "Investigating",
  planned: "Planned",
  in_progress: "In progress",
  findings_open: "Findings open",
  requested: "Requested",
  approved: "Approved",
  active: "Active",
  suspended: "Suspended",
  rejected: "Rejected",
  in_review: "In review",
  expired: "Expired",
  superseded: "Superseded",
  review_due: "Review due",
  archived: "Archived",
  open: "Open",
};

export const TRANSITIONS = {
  near_miss: {
    draft: ["submitted"],
    submitted: ["under_review"],
    under_review: ["actions_open", "closed"],
    actions_open: ["closed"],
    closed: [],
  },
  incident: {
    draft: ["reported"],
    reported: ["investigating"],
    investigating: ["actions_open", "closed"],
    actions_open: ["closed"],
    closed: [],
  },
  audit: {
    planned: ["in_progress"],
    in_progress: ["findings_open", "closed"],
    findings_open: ["closed"],
    closed: [],
  },
  finding: {
    open: ["in_progress", "closed"],
    in_progress: ["closed", "open"],
    closed: ["open"],
  },
  permit: {
    draft: ["requested"],
    requested: ["approved", "rejected"],
    approved: ["active", "closed"],
    active: ["suspended", "closed"],
    suspended: ["active", "closed"],
    rejected: [],
    closed: [],
  },
  jsa: {
    draft: ["in_review"],
    in_review: ["approved", "draft"],
    approved: ["expired", "superseded"],
    expired: ["draft"],
    superseded: [],
  },
  risk: {
    draft: ["in_review"],
    in_review: ["approved", "draft"],
    approved: ["review_due", "archived"],
    review_due: ["in_review", "archived"],
    archived: [],
  },
  action: {
    open: ["in_progress", "closed"],
    in_progress: ["closed", "open"],
    closed: ["open"],
  },
};

export const ENUMS = {
  nearMissCategory: [
    ["slip_trip", "Slip / trip"],
    ["dropped_object", "Dropped object"],
    ["isolation", "Energy isolation"],
    ["vehicle", "Vehicle / mobile plant"],
    ["chemical", "Chemical exposure"],
    ["height", "Working at height"],
    ["housekeeping", "Housekeeping"],
    ["equipment", "Equipment"],
    ["environmental", "Environmental"],
    ["procedure", "Procedure"],
  ],
  nearMissSeverity: [
    ["low", "Low"],
    ["medium", "Medium"],
    ["high", "High"],
    ["critical", "Critical"],
  ],
  incidentType: [
    ["injury", "Injury"],
    ["illness", "Illness"],
    ["environmental", "Environmental"],
    ["property", "Property damage"],
    ["vehicle", "Vehicle"],
    ["process_safety", "Process safety"],
  ],
  incidentSeverity: [
    ["first_aid", "First aid"],
    ["medical", "Medical treatment"],
    ["lost_time", "Lost time"],
    ["serious", "Serious / high potential"],
    ["environmental", "Environmental release"],
    ["property", "Property damage"],
  ],
  auditType: [
    ["internal", "Internal"],
    ["external", "External"],
    ["regulatory", "Regulatory"],
    ["behavioral", "Behavioral"],
  ],
  findingSeverity: [
    ["observation", "Observation"],
    ["minor", "Minor"],
    ["major", "Major"],
    ["critical", "Critical"],
  ],
  permitType: [
    ["hot_work", "Hot work"],
    ["confined_space", "Confined space"],
    ["electrical", "Electrical"],
    ["height", "Working at height"],
    ["excavation", "Excavation"],
    ["lifting", "Lifting"],
    ["cold_work", "Cold work"],
    ["line_break", "Line break"],
  ],
  jsaRisk: [
    ["low", "Low"],
    ["medium", "Medium"],
    ["high", "High"],
  ],
  riskRating: [
    ["low", "Low (1–4)"],
    ["medium", "Medium (5–9)"],
    ["high", "High (10–16)"],
    ["critical", "Critical (17–25)"],
  ],
  likelihood: [
    [1, "1 — Rare"],
    [2, "2 — Unlikely"],
    [3, "3 — Possible"],
    [4, "4 — Likely"],
    [5, "5 — Almost certain"],
  ],
  consequence: [
    [1, "1 — Negligible"],
    [2, "2 — Minor"],
    [3, "3 — Moderate"],
    [4, "4 — Major"],
    [5, "5 — Catastrophic"],
  ],
};

export const RECORDABLE_SEVERITIES = ["medical", "lost_time", "serious"];

export const RISK_REGISTER_STATUSES = ["in_review", "approved", "review_due"];

export const PERMIT_OPEN_STATUSES = ["approved", "active", "suspended"];

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso() {
  return new Date().toISOString();
}

export function defaultFrom(to) {
  const y = Number(to.slice(0, 4));
  const m = Number(to.slice(5, 7));
  return new Date(Date.UTC(y, m - 1 - 11, 1)).toISOString().slice(0, 10);
}

export function lastDay(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function eachMonth(from, to) {
  const out = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const end = to.slice(0, 7);
  while (true) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key > end) break;
    out.push(key);
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function clipMonth(month, from, to) {
  const start = `${month}-01`;
  const end = lastDay(month);
  return {
    from: start > from ? start : from,
    to: end < to ? end : to,
  };
}

export function monthLabel(month) {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, m] = month.split("-");
  return `${names[Number(m) - 1]} ${y}`;
}

export function riskBand(score) {
  const n = Number(score) || 0;
  if (n >= 17) return "critical";
  if (n >= 10) return "high";
  if (n >= 5) return "medium";
  return "low";
}

export function link(path, params = {}) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      sp.set(key, value.join(","));
    } else {
      sp.set(key, String(value));
    }
  }
  const query = sp.toString();
  return query ? `${path}?${query}` : path;
}

export function emptyFilter(over = {}) {
  return {
    siteId: null,
    departmentId: null,
    status: [],
    severity: [],
    category: null,
    permitType: null,
    incidentType: null,
    auditType: null,
    rating: [],
    from: null,
    to: null,
    q: "",
    open: false,
    overdue: false,
    stale: false,
    recordable: false,
    lostTime: false,
    reviewDue: false,
    sourceType: null,
    sourceId: null,
    auditId: null,
    ...over,
  };
}

function positiveInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const STATUS_SET = new Set(Object.keys(STATUS_LABELS));
const RATING_SET = new Set(ENUMS.riskRating.map(([id]) => id));
const SEVERITY_SET = new Set([
  ...ENUMS.nearMissSeverity.map(([id]) => id),
  ...ENUMS.incidentSeverity.map(([id]) => id),
  ...ENUMS.findingSeverity.map(([id]) => id),
]);

function splitList(value, allowed, label) {
  if (!value) return [];
  const items = String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const item of items) {
    if (!allowed.has(item)) throw new HttpError(400, `${label} "${item}" is not recognized`);
  }
  return items;
}

export function filterFromQuery(query) {
  const f = emptyFilter();
  const siteId = positiveInt(query.siteId);
  if (query.siteId && !siteId) throw new HttpError(400, "Invalid site");
  f.siteId = siteId;
  const departmentId = positiveInt(query.departmentId);
  if (query.departmentId && !departmentId) throw new HttpError(400, "Invalid department");
  f.departmentId = departmentId;
  const sourceId = positiveInt(query.sourceId);
  if (query.sourceId && !sourceId) throw new HttpError(400, "Invalid source");
  f.sourceId = sourceId;
  const auditId = positiveInt(query.auditId);
  if (query.auditId && !auditId) throw new HttpError(400, "Invalid audit");
  f.auditId = auditId;
  f.status = splitList(query.status, STATUS_SET, "Status");
  f.severity = splitList(query.severity, SEVERITY_SET, "Severity");
  f.rating = splitList(query.rating, RATING_SET, "Rating");
  if (query.from) {
    if (!isDate(query.from)) throw new HttpError(400, "Invalid from date");
    f.from = query.from;
  }
  if (query.to) {
    if (!isDate(query.to)) throw new HttpError(400, "Invalid to date");
    f.to = query.to;
  }
  if (f.from && f.to && f.from > f.to) throw new HttpError(400, "From date is after to date");
  f.q = String(query.q || "").trim().slice(0, 100);
  f.category = query.category ? String(query.category) : null;
  f.permitType = query.permitType ? String(query.permitType) : null;
  f.incidentType = query.incidentType ? String(query.incidentType) : null;
  f.auditType = query.auditType ? String(query.auditType) : null;
  f.sourceType = query.sourceType ? String(query.sourceType) : null;
  f.open = query.open === "1";
  f.overdue = query.overdue === "1";
  f.stale = query.stale === "1";
  f.recordable = query.recordable === "1";
  f.lostTime = query.lostTime === "1";
  f.reviewDue = query.reviewDue === "1";
  const enumCheck = [
    [f.category, ENUMS.nearMissCategory, "Category"],
    [f.permitType, ENUMS.permitType, "Permit type"],
    [f.incidentType, ENUMS.incidentType, "Incident type"],
    [f.auditType, ENUMS.auditType, "Audit type"],
  ];
  for (const [value, list, label] of enumCheck) {
    if (value && !list.some(([id]) => id === value)) throw new HttpError(400, `${label} is not recognized`);
  }
  if (f.sourceType && !["near_miss", "incident", "audit", "finding", "permit", "jsa", "risk"].includes(f.sourceType)) {
    throw new HttpError(400, "Source type is not recognized");
  }
  return f;
}

export function resolvePeriod(query) {
  const f = filterFromQuery(query);
  const to = f.to || today();
  const from = f.from || defaultFrom(to);
  if (from > to) throw new HttpError(400, "From date is after to date");
  return { ...f, from, to };
}

export function reqText(value, label, max = 4000) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new HttpError(400, `${label} is required`);
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer`);
  return text;
}

export function optText(value, label, max = 4000) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer`);
  return text;
}

export function reqId(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${label} is required`);
  return n;
}

export function optId(value, label) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${label} is invalid`);
  return n;
}

export function reqDate(value, label, { notFuture = false } = {}) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${label} must be a date`);
  }
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new HttpError(400, `${label} must be a real date`);
  }
  if (notFuture && value > today()) throw new HttpError(400, `${label} cannot be in the future`);
  return value;
}

export function reqEnum(value, list, label) {
  if (!list.some(([id]) => String(id) === String(value))) throw new HttpError(400, `${label} is not recognized`);
  return String(value);
}

export function reqScore(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new HttpError(400, `${label} must be from 1 to 5`);
  return n;
}

export function camel(row) {
  if (!row) return null;
  const out = {};
  for (const key of Object.keys(row)) {
    out[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = row[key];
  }
  return out;
}
