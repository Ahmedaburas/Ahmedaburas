/** Partner subscription plan limits — demo defaults (proposed, not validated). */

export type PlanId = 'launch' | 'growth' | 'pro' | 'business' | 'enterprise'

export type SubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'

/** Default Founding Partner / Pro trial length. Configurable via DARFIX_TRIAL_DAYS. */
export const DEFAULT_TRIAL_DAYS = Number(process.env.DARFIX_TRIAL_DAYS || 14)

/** Plans partners can self-checkout with Mada/Visa/Mastercard (not Launch free / Enterprise). */
export const CHECKOUT_PLAN_IDS: PlanId[] = ['growth', 'pro', 'business']

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

export function isCheckoutPlan(plan: string): plan is PlanId {
  return (CHECKOUT_PLAN_IDS as string[]).includes(plan)
}

export function planPriceSar(plan: string): number | null {
  const id = plan as PlanId
  return PLAN_LIMITS[id]?.priceSar ?? null
}

/** Trial still open (trial_ends_at in the future). */
export function isTrialActive(trialEndsAtIso: string | null | undefined, now = new Date()): boolean {
  if (!trialEndsAtIso) return false
  const end = new Date(trialEndsAtIso).getTime()
  return !Number.isNaN(end) && end > now.getTime()
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
