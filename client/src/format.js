import { useEffect } from "react";

export const STATUS_TONE = {
  draft: "neutral",
  submitted: "info",
  under_review: "info",
  actions_open: "warn",
  closed: "good",
  reported: "info",
  investigating: "info",
  planned: "info",
  in_progress: "info",
  findings_open: "warn",
  requested: "info",
  approved: "good",
  active: "good",
  suspended: "warn",
  rejected: "bad",
  in_review: "info",
  expired: "bad",
  superseded: "neutral",
  review_due: "warn",
  archived: "neutral",
  open: "warn",
};

export const SEVERITY_TONE = {
  low: "good",
  medium: "warn",
  high: "bad",
  critical: "bad",
  observation: "neutral",
  minor: "warn",
  major: "bad",
  first_aid: "good",
  medical: "warn",
  lost_time: "bad",
  serious: "bad",
  environmental: "warn",
  property: "warn",
};

export const SOURCE_PATH = {
  near_miss: "/near-misses",
  incident: "/incidents",
  audit: "/audits",
  finding: "/findings",
  permit: "/permits",
  jsa: "/jsa",
  risk: "/risks",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(value) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return value;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatWhen(value) {
  if (!value) return "—";
  const date = formatDate(value);
  const time = value.length > 10 ? value.slice(11, 16) : "";
  return time ? `${date}, ${time}` : date;
}

export function enumLabel(meta, key, id) {
  const hit = meta.enums[key]?.find(([value]) => String(value) === String(id));
  return hit ? hit[1] : id || "—";
}

export function statusLabel(meta, status) {
  return meta.labels.status[status] || status || "—";
}

export function riskBand(score) {
  const n = Number(score) || 0;
  if (n >= 17) return "critical";
  if (n >= 10) return "high";
  if (n >= 5) return "medium";
  return "low";
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · HSE` : "HSE platform";
  }, [title]);
}
