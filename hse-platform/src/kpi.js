/** OSHA total recordable incident rate, per 200,000 hours. */
export function trir(recordable, hoursWorked) {
  if (!hoursWorked) return null;
  return round((recordable * 200_000) / hoursWorked);
}

/** Lost-time injury frequency rate, per 1,000,000 hours. */
export function ltifr(lostTimeInjuries, hoursWorked) {
  if (!hoursWorked) return null;
  return round((lostTimeInjuries * 1_000_000) / hoursWorked);
}

export function riskScore(likelihood, severity) {
  return likelihood * severity;
}

export function riskBand(score) {
  if (score >= 17) return 'extreme';
  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

function round(value) {
  return Math.round(value * 100) / 100;
}
