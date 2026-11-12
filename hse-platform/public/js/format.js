export const LABELS = {
  injury: 'Injury',
  near_miss: 'Near miss',
  property: 'Property',
  environmental: 'Environmental',
  fire: 'Fire',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
  reported: 'Reported',
  investigating: 'Investigating',
  actions_open: 'Actions open',
  closed: 'Closed',
  safe: 'Safe',
  at_risk: 'At risk',
  ppe: 'PPE',
  housekeeping: 'Housekeeping',
  lifting: 'Lifting',
  hot_work: 'Hot work',
  line_of_fire: 'Line of fire',
  environment: 'Environment',
  tools: 'Tools',
  draft: 'Draft',
  approved: 'Approved',
  work_at_height: 'Work at height',
  confined_space: 'Confined space',
  excavation: 'Excavation',
  electrical_isolation: 'Electrical isolation',
  requested: 'Requested',
  issued: 'Issued',
  active: 'Active',
  suspended: 'Suspended',
  rejected: 'Rejected',
  open: 'Open',
  in_progress: 'In progress',
  actions_required: 'Actions required',
  satisfactory: 'Satisfactory',
  pass: 'Pass',
  fail: 'Fail',
  na: 'N/A',
  extreme: 'Extreme',
};

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

export function label(value) {
  if (value == null || value === '') return '—';
  return LABELS[value] || String(value);
}

export function fmtNum(value, digits = 0) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function fmtWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function fmtDay(value) {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+03:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function fmtMonth(key) {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function todayInput() {
  const parts = riyadhParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function nowInput() {
  const parts = riyadhParts();
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function yardClock() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

function riyadhParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '00';
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}
