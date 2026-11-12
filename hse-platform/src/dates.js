const RIYADH = 'Asia/Riyadh';

export function riyadhToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function riyadhDate(offsetDays = 0, now = new Date()) {
  const [year, month, day] = riyadhToday(now).split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return utc.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const [year, month, day] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

/** Interpret a date or datetime-local value as Asia/Riyadh and return an ISO string. */
export function parseYardTime(value, now = new Date()) {
  if (value == null || value === '') return now.toISOString();
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T00:00:00+03:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00+03:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

export function isDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
