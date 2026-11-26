/** Partner subscription plan limits — demo defaults (proposed, not validated). */

export type PlanId = 'launch' | 'growth' | 'pro' | 'business' | 'enterprise'

/** Default Founding Partner / Pro trial length. Configurable via DARFIX_TRIAL_DAYS. */
export const DEFAULT_TRIAL_DAYS = Number(process.env.DARFIX_TRIAL_DAYS || 14)

export const PLAN_LIMITS: Record<
  PlanId,
  {
    maxTechnicians: number | null
    priceSar: number | null
    labelEn: string
  }
> = {
  launch: { maxTechnicians: 1, priceSar: 0, labelEn: 'Launch' },
  growth: { maxTechnicians: 3, priceSar: 149, labelEn: 'Growth' },
  pro: { maxTechnicians: 10, priceSar: 399, labelEn: 'Pro' },
  business: { maxTechnicians: 25, priceSar: 799, labelEn: 'Business' },
  enterprise: { maxTechnicians: null, priceSar: null, labelEn: 'Enterprise' },
}

export function planMaxTechnicians(plan: string | null | undefined): number | null {
  const id = (plan || 'launch') as PlanId
  return PLAN_LIMITS[id]?.maxTechnicians ?? PLAN_LIMITS.launch.maxTechnicians
}

export function trialEndsAt(from = new Date(), days = DEFAULT_TRIAL_DAYS): string {
  return new Date(from.getTime() + days * 86400000).toISOString()
}

/** City → short code for human technician IDs (DFX-KHB-00042). */
const CITY_CODES: Record<string, string> = {
  khobar: 'KHB',
  dhahran: 'DHR',
  dammam: 'DMM',
  jubail: 'JUB',
}

export function cityCode(cityId: string | null | undefined): string {
  if (!cityId) return 'EP'
  return CITY_CODES[cityId] || cityId.slice(0, 3).toUpperCase()
}

export function formatTechnicianCode(cityId: string | null | undefined, seq: number): string {
  return `DFX-${cityCode(cityId)}-${String(seq).padStart(5, '0')}`
}
