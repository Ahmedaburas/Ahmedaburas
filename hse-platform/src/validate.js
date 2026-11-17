import { isDateOnly, parseYardTime } from './dates.js';

export function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function requiredString(value, field, max = 500) {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`${field} is too long`);
  return trimmed;
}

export function oneOf(value, field, options) {
  if (!options.includes(value)) {
    throw badRequest(`${field} must be one of: ${options.join(', ')}`);
  }
  return value;
}

export function optionalString(value, field, max = 2000) {
  if (value == null || value === '') return '';
  return requiredString(value, field, max);
}

export function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

export function score(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5) {
    throw badRequest(`${field} must be an integer from 1 to 5`);
  }
  return number;
}

export function dateOnly(value, field) {
  if (!isDateOnly(value)) throw badRequest(`${field} must be a YYYY-MM-DD date`);
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw badRequest(`${field} is not a real date`);
  }
  return value;
}

export function yardTime(value, field, now = new Date()) {
  const parsed = parseYardTime(value, value == null || value === '' ? now : undefined);
  if (!parsed) throw badRequest(`${field} must be a date or datetime`);
  return parsed;
}

export function heatIndex(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 15 || number > 70) {
    throw badRequest('heatIndexC must be a number from 15 to 70');
  }
  return Math.round(number * 10) / 10;
}

export function hoursWorked(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 100_000_000) {
    throw badRequest('hoursWorked must be a positive whole number');
  }
  return number;
}
