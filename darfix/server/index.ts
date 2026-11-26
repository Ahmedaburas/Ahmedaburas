import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, migrate, uid } from './db'
import {
  mapBooking,
  mapDiscount,
  mapInvoice,
  mapLeadOffer,
  mapNotification,
  mapOrganization,
  mapOrgMember,
  mapQuotation,
  mapUser,
} from './mappers'
import {
  DEFAULT_TRIAL_DAYS,
  formatTechnicianCode,
  isCheckoutPlan,
  isTrialActive,
  PLAN_LIMITS,
  planMaxTechnicians,
  planPriceSar,
  trialEndsAt,
  type PlanId,
} from './plans'
import {
  getPaymentProvider,
  paymentsMode,
  publicAppBaseUrl,
} from './payments'
import { demoSeedEnabled, seedIfEmpty } from './seed'
import { defaultChecklist, emptyProcess, type BookingProcess, type BookingStatus } from './types'

migrate()
seedIfEmpty()

const app = express()
const PORT = Number(process.env.PORT || 8787)

/** Hosted / pilot lock-down (secret required, CORS closed, mock pay off unless flagged). */
function isProdLike(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.DARFIX_REQUIRE_SECRET === '1'
}

/**
 * Mock invoice/subscription pay is for local smoke only.
 * Disabled when prod-like or when a real DARFIX_SECRET is bound (hosted),
 * unless DARFIX_ALLOW_MOCK_PAY=1 is set explicitly.
 */
function allowMockPayments(): boolean {
  if (paymentsMode() !== 'mock') return false
  if (process.env.DARFIX_ALLOW_MOCK_PAY === '1') return true
  if (isProdLike()) return false
  // Bound app secret ⇒ hosted/pilot — do not allow free mark-paid.
  if (process.env.DARFIX_SECRET || process.env.JWT_SECRET) return false
  return true
}

/**
 * Session/app secret: env only in production/pilot; never a fixed fallback string in source.
 * Local demo may generate an ephemeral secret for this process when unset.
 */
function resolveAppSecret(): string {
  const fromEnv = process.env.DARFIX_SECRET || process.env.JWT_SECRET
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  if (isProdLike()) {
    console.error(
      'FATAL: DARFIX_SECRET (or JWT_SECRET) is required when NODE_ENV=production or DARFIX_REQUIRE_SECRET=1',
    )
    process.exit(1)
  }
  const ephemeral = crypto.randomBytes(32).toString('hex')
  console.warn(
    '[darfix] DARFIX_SECRET unset — using ephemeral process secret (local demo only; never ship a fixed default)',
  )
  return ephemeral
}
const APP_SECRET = resolveAppSecret()
void APP_SECRET // reserved for signed tokens / future JWT; must resolve at boot

function corsOriginOption(): cors.CorsOptions['origin'] {
  const list = (process.env.DARFIX_CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (list.length) {
    return (origin, callback) => {
      if (!origin || list.includes(origin)) callback(null, true)
      else callback(null, false)
    }
  }
  // Combined pilot / production without allowlist: same-origin only (SPA served by Express).
  if (isProdLike()) {
    return false
  }
  // Local Vite + API: loopback only — never reflect arbitrary Origin.
  const localDefaults = new Set([
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:8787',
    'http://localhost:8787',
    'http://127.0.0.1:8790',
    'http://localhost:8790',
  ])
  return (origin, callback) => {
    if (!origin || localDefaults.has(origin)) callback(null, true)
    else callback(null, false)
  }
}

app.use(cors({ origin: corsOriginOption(), credentials: true }))
app.use(express.json({ limit: '8mb' }))

type Authed = express.Request & { userId?: string; userRole?: string }

/** Booking mutation capability for role-scoped checks. */
type BookingAction =
  | 'status'
  | 'assign'
  | 'photos'
  | 'costs'
  | 'report'
  | 'extra_work'
  | 'extra_work_respond'
  | 'rate'
  | 'process'
  | 'tech_respond'
  | 'gps'
  | 'field' // generic field/ops mutation

const CUSTOMER_ONLY_ACTIONS = new Set<BookingAction>(['rate', 'extra_work_respond'])
const FIELD_ACTIONS = new Set<BookingAction>([
  'status',
  'photos',
  'costs',
  'report',
  'extra_work',
  'process',
  'field',
  'tech_respond',
  'gps',
])

function auth(req: Authed, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const session = db
    .prepare(`SELECT * FROM sessions WHERE token = ? AND expires_at > ?`)
    .get(token, new Date().toISOString()) as { user_id: string } | undefined
  if (!session) return res.status(401).json({ error: 'Session expired' })
  const user = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(session.user_id) as
    | { id: string; role: string }
    | undefined
  if (!user) return res.status(401).json({ error: 'User not found' })
  req.userId = user.id
  req.userRole = user.role
  next()
}

/**
 * Role- and tenant-scoped booking authorization.
 * - customer: own bookings only; customer-facing actions
 * - technician: assigned bookings only; field updates (not customer-only)
 * - provider / company: bookings for their organization_id
 * - admin: full access
 */
function assertBookingAccess(
  req: Authed,
  booking: Record<string, unknown>,
  action: BookingAction,
): { ok: true } | { ok: false; status: number; error: string } {
  const role = req.userRole || ''
  const userId = req.userId
  if (!userId) return { ok: false, status: 401, error: 'Unauthorized' }

  if (role === 'admin') return { ok: true }

  if (role === 'customer') {
    if (booking.customer_id !== userId) {
      return { ok: false, status: 403, error: 'Not your booking' }
    }
    if (FIELD_ACTIONS.has(action) && !CUSTOMER_ONLY_ACTIONS.has(action)) {
      // Customers may cancel via status in some flows — allow only cancel/confirm-ish, not field ops
      if (action === 'status') return { ok: true }
      return { ok: false, status: 403, error: 'Customers cannot perform this action' }
    }
    return { ok: true }
  }

  if (role === 'technician') {
    if (CUSTOMER_ONLY_ACTIONS.has(action)) {
      return { ok: false, status: 403, error: 'Customers only' }
    }
    if (action === 'assign') {
      return { ok: false, status: 403, error: 'Providers/admins only' }
    }
    if (booking.technician_id !== userId) {
      return { ok: false, status: 403, error: 'Not your assigned job' }
    }
    return { ok: true }
  }

  if (role === 'provider') {
    if (CUSTOMER_ONLY_ACTIONS.has(action)) {
      return { ok: false, status: 403, error: 'Customers only' }
    }
    const myOrg = userOrgId(userId)
    if (!myOrg) return { ok: false, status: 403, error: 'No organization' }
    const bookingOrg = (booking.organization_id as string | null) || null
    if (bookingOrg && bookingOrg !== myOrg) {
      return { ok: false, status: 403, error: 'Booking not in your organization' }
    }
    // Unassigned marketplace jobs (incl. assign): require an accepted lead offer.
    // Pending "offered" leads are answered via /api/lead-offers/:id/respond, not booking mutations.
    if (!bookingOrg) {
      const offer = db
        .prepare(
          `SELECT id FROM lead_offers WHERE booking_id = ? AND organization_id = ? AND status = 'accepted' LIMIT 1`,
        )
        .get(booking.id, myOrg) as { id: string } | undefined
      if (!offer) {
        return { ok: false, status: 403, error: 'Booking not in your organization' }
      }
    }
    return { ok: true }
  }

  return { ok: false, status: 403, error: 'Forbidden' }
}

function requireBookingAccess(
  req: Authed,
  res: express.Response,
  booking: Record<string, unknown> | undefined,
  action: BookingAction,
): booking is Record<string, unknown> {
  if (!booking) {
    res.status(404).json({ error: 'Not found' })
    return false
  }
  const gate = assertBookingAccess(req, booking, action)
  if (!gate.ok) {
    res.status(gate.status).json({ error: gate.error })
    return false
  }
  return true
}

function isFoundingAllowlistedEmail(email: string): boolean {
  const raw = process.env.DARFIX_FOUNDING_EMAILS || ''
  const allow = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (!allow.length) return false
  return allow.includes(email.trim().toLowerCase())
}

function createSession(userId: string, opts?: { deviceLabel?: string; singleSession?: boolean }) {
  const token = crypto.randomBytes(32).toString('hex')
  const created = new Date()
  const expires = new Date(created.getTime() + 7 * 86400000)
  if (opts?.singleSession) {
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId)
  }
  db.prepare(
    `INSERT INTO sessions (token, user_id, created_at, expires_at, device_label) VALUES (?, ?, ?, ?, ?)`,
  ).run(token, userId, created.toISOString(), expires.toISOString(), opts?.deviceLabel ?? null)
  db.prepare(`UPDATE users SET last_active_at = ? WHERE id = ?`).run(created.toISOString(), userId)
  return token
}

function nextTechnicianCode(cityId: string): string {
  const prefix = `DFX-${cityId === 'khobar' ? 'KHB' : cityId === 'dhahran' ? 'DHR' : cityId === 'dammam' ? 'DMM' : cityId === 'jubail' ? 'JUB' : 'EP'}-`
  const rows = db
    .prepare(`SELECT technician_code FROM users WHERE technician_code LIKE ?`)
    .all(`${prefix}%`) as { technician_code: string }[]
  let max = 0
  for (const r of rows) {
    const n = Number(r.technician_code.split('-').pop())
    if (!Number.isNaN(n) && n > max) max = n
  }
  return formatTechnicianCode(cityId, max + 1)
}

function countActiveTechnicianSeats(organizationId: string): number {
  // Seat = active user with role technician bound to this org (1 account = 1 seat).
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM users
       WHERE organization_id = ? AND role = 'technician' AND active = 1`,
    )
    .get(organizationId) as { c: number }
  return row?.c ?? 0
}

function assertOrgSeatAvailable(organizationId: string) {
  const org = db.prepare(`SELECT * FROM provider_organizations WHERE id = ?`).get(organizationId) as
    | Record<string, unknown>
    | undefined
  if (!org) return { ok: false as const, error: 'Organization not found', status: 404 }
  const max = planMaxTechnicians(org.subscription_plan as string)
  if (max === null) return { ok: true as const, org, max, used: countActiveTechnicianSeats(organizationId) }
  const used = countActiveTechnicianSeats(organizationId)
  if (used >= max) {
    return {
      ok: false as const,
      error: `Technician seat limit reached (${used}/${max}). Upgrade your plan for more seats.`,
      status: 403,
      org,
      max,
      used,
    }
  }
  return { ok: true as const, org, max, used }
}

function notify(input: {
  userId: string
  type: string
  titleEn: string
  titleAr: string
  bodyEn: string
  bodyAr: string
  bookingId?: string
}) {
  db.prepare(
    `INSERT INTO notifications (id, user_id, type, title_en, title_ar, body_en, body_ar, booking_id, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(
    uid('n'),
    input.userId,
    input.type,
    input.titleEn,
    input.titleAr,
    input.bodyEn,
    input.bodyAr,
    input.bookingId ?? null,
    new Date().toISOString(),
  )
}

function getEffectiveFee(categoryId: string, problemId: string) {
  const override = db
    .prepare(`SELECT base_fee_sar FROM pricing_overrides WHERE category_id = ? AND problem_id = ?`)
    .get(categoryId, problemId) as { base_fee_sar: number } | undefined
  if (override) return override.base_fee_sar
  const defaults: Record<string, number> = {
    'plumbing:water-leaks': 120,
    'plumbing:blocked-drains': 150,
    'plumbing:faucet-repair': 100,
    'plumbing:toilet-repair': 130,
    'plumbing:water-heater': 180,
    'plumbing:pipe-replacement': 220,
    'plumbing:water-pressure': 140,
    'electrical:power-outages': 150,
    'electrical:electrical-faults': 160,
    'electrical:switch-socket': 110,
    'electrical:lighting-install': 140,
    'electrical:circuit-breaker': 170,
    'electrical:wiring-inspection': 200,
    'electrical:electrical-troubleshoot': 180,
  }
  return defaults[`${categoryId}:${problemId}`] ?? 150
}

function userOrgId(userId: string): string | undefined {
  const row = db.prepare(`SELECT organization_id FROM users WHERE id = ?`).get(userId) as
    | { organization_id: string | null }
    | undefined
  return row?.organization_id || undefined
}

/** Public-safe partner card — no phones, CR, emails, WhatsApp, or internal ops fields. */
function publicOrganization(org: ReturnType<typeof mapOrganization>) {
  return {
    id: org.id,
    kind: org.kind,
    name: org.name,
    nameAr: org.nameAr,
    cityId: org.cityId,
    serviceCityIds: org.serviceCityIds,
    status: org.status,
    foundingPartner: org.foundingPartner,
    specialties: org.specialties,
  }
}

/** Strip sensitive org fields unless admin or the caller's own organization. */
function organizationsForRole(
  orgs: ReturnType<typeof mapOrganization>[],
  role: string,
  ownOrgId?: string,
) {
  if (role === 'admin') return orgs
  return orgs.map((o) => (ownOrgId && o.id === ownOrgId ? o : publicOrganization(o)))
}

/** Validate client-submitted cost lines before append. */
function sanitizeCostLines(
  incoming: unknown,
): { ok: true; lines: object[] } | { ok: false; error: string } {
  if (!Array.isArray(incoming)) return { ok: false, error: 'costs must be an array' }
  if (incoming.length > 20) return { ok: false, error: 'Too many cost lines' }
  const allowedTypes = new Set(['labor', 'materials', 'fee', 'discount'])
  const lines: object[] = []
  for (const raw of incoming) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid cost line' }
    const item = raw as Record<string, unknown>
    const label = typeof item.label === 'string' ? item.label.trim() : ''
    if (!label || label.length > 200) return { ok: false, error: 'Invalid cost label' }
    const amount = Number(item.amountSar)
    if (!Number.isFinite(amount) || Math.abs(amount) > 100_000) {
      return { ok: false, error: 'Invalid cost amount' }
    }
    const type = typeof item.type === 'string' ? item.type : 'materials'
    if (!allowedTypes.has(type)) return { ok: false, error: 'Invalid cost type' }
    // Field staff may only add labor/materials with non-negative amounts (no discounts/fees).
    if (type === 'discount' || type === 'fee') {
      return { ok: false, error: 'Only labor/materials may be added via this endpoint' }
    }
    if (amount < 0) return { ok: false, error: 'Cost amount must be >= 0' }
    lines.push({
      id: typeof item.id === 'string' && item.id.length < 64 ? item.id : uid('cost'),
      label,
      amountSar: Math.round(amount * 100) / 100,
      type,
    })
  }
  return { ok: true, lines }
}

function loadBootstrap(userId: string, role: string, locale: 'en' | 'ar') {
  let users = db
    .prepare(`SELECT * FROM users`)
    .all()
    .map((u) => mapUser(u as Record<string, unknown>))

  const organizations = db
    .prepare(`SELECT * FROM provider_organizations ORDER BY name`)
    .all()
    .map((o) => mapOrganization(o as Record<string, unknown>))

  const organizationMembers = db
    .prepare(`SELECT * FROM organization_members`)
    .all()
    .map((m) => mapOrgMember(m as Record<string, unknown>))

  let bookings = db.prepare(`SELECT * FROM bookings ORDER BY created_at DESC`).all().map((b) =>
    mapBooking(b as Record<string, unknown>),
  )
  if (role === 'customer') bookings = bookings.filter((b) => b.customerId === userId)
  if (role === 'technician') bookings = bookings.filter((b) => b.technicianId === userId)
  if (role === 'provider') {
    const orgId = userOrgId(userId)
    bookings = bookings.filter((b) => b.organizationId === orgId)
  }

  const notifications = db
    .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`)
    .all(userId)
    .map((n) => mapNotification(n as Record<string, unknown>))

  const bookingIds = new Set(bookings.map((b) => b.id))
  const quotations = db
    .prepare(`SELECT * FROM quotations ORDER BY created_at DESC`)
    .all()
    .map((q) => mapQuotation(q as Record<string, unknown>))
    .filter((q) => role === 'admin' || bookingIds.has(q.bookingId))

  const invoices = db
    .prepare(`SELECT * FROM invoices ORDER BY created_at DESC`)
    .all()
    .map((i) => mapInvoice(i as Record<string, unknown>))
    .filter((i) => role === 'admin' || i.customerId === userId || bookingIds.has(i.bookingId))

  const discountCodes = db
    .prepare(`SELECT * FROM discount_codes`)
    .all()
    .map((d) => mapDiscount(d as Record<string, unknown>))

  const pricingOverrides = (
    db.prepare(`SELECT * FROM pricing_overrides`).all() as {
      category_id: string
      problem_id: string
      base_fee_sar: number
    }[]
  ).map((p) => ({
    categoryId: p.category_id,
    problemId: p.problem_id,
    baseFeeSar: p.base_fee_sar,
  }))

  let visibleOrgs = organizations
  let visibleMembers = organizationMembers
  const ownOrgId = userOrgId(userId)
  if (role === 'provider') {
    visibleOrgs = organizations.filter((o) => o.id === ownOrgId)
    visibleMembers = organizationMembers.filter((m) => m.organizationId === ownOrgId)
    const memberUserIds = new Set(visibleMembers.map((m) => m.userId))
    const bookingCustomerIds = new Set(bookings.map((b) => b.customerId))
    users = users.filter(
      (u) => u.id === userId || memberUserIds.has(u.id) || bookingCustomerIds.has(u.id),
    )
  } else if (role === 'technician') {
    visibleOrgs = organizations.filter((o) => o.id === ownOrgId)
    visibleMembers = organizationMembers.filter((m) => m.organizationId === ownOrgId)
    const memberUserIds = new Set(visibleMembers.map((m) => m.userId))
    const bookingCustomerIds = new Set(bookings.map((b) => b.customerId))
    users = users.filter(
      (u) => u.id === userId || memberUserIds.has(u.id) || bookingCustomerIds.has(u.id),
    )
  } else if (role === 'customer') {
    // Customers see active partners for match/choose UX + orgs on their bookings (public fields only)
    const linked = new Set(bookings.map((b) => b.organizationId).filter(Boolean) as string[])
    visibleOrgs = organizations.filter(
      (o) => o.status === 'active' || linked.has(o.id),
    )
    visibleMembers = [] // no cross-tenant member directory for customers
    const techIds = new Set(bookings.map((b) => b.technicianId).filter(Boolean) as string[])
    users = users
      .filter((u) => u.id === userId || techIds.has(u.id))
      .map((u) =>
        u.id === userId
          ? u
          : { ...u, email: '', phone: '', password: undefined },
      )
  }

  visibleOrgs = organizationsForRole(visibleOrgs, role, ownOrgId) as typeof organizations

  let leadOffers = db
    .prepare(`SELECT * FROM lead_offers ORDER BY offered_at DESC`)
    .all()
    .map((r) => mapLeadOffer(r as Record<string, unknown>))
  if (role === 'provider') {
    const orgId = userOrgId(userId)
    leadOffers = leadOffers.filter((o) => o.organizationId === orgId)
  } else if (role === 'customer') {
    const ids = new Set(bookings.map((b) => b.id))
    leadOffers = leadOffers.filter((o) => ids.has(o.bookingId))
  } else if (role === 'technician') {
    leadOffers = []
  }

  // Provider also sees bookings offered via open lead offers
  if (role === 'provider') {
    const orgId = userOrgId(userId)
    const offerBookingIds = new Set(
      leadOffers.filter((o) => o.status === 'offered' || o.status === 'accepted').map((o) => o.bookingId),
    )
    const extra = db
      .prepare(`SELECT * FROM bookings ORDER BY created_at DESC`)
      .all()
      .map((b) => mapBooking(b as Record<string, unknown>))
      .filter((b) => offerBookingIds.has(b.id) && !bookings.some((x) => x.id === b.id))
    bookings = [...extra, ...bookings]
  }

  return {
    users: users.map((u) => ({ ...u, password: undefined })),
    bookings,
    notifications,
    quotations,
    invoices,
    // Never list all discount codes to customers — apply validates a code at booking time.
    discountCodes: role === 'admin' ? discountCodes : [],
    pricingOverrides: role === 'admin' ? pricingOverrides : [],
    organizations: visibleOrgs,
    organizationMembers: visibleMembers,
    leadOffers,
    sessionUserId: userId,
    locale,
  }
}

function eligiblePartnerOrgs(cityId: string, preferredOrgId?: string) {
  const rows = db
    .prepare(
      `SELECT * FROM provider_organizations WHERE status = 'active' AND kind = 'company' ORDER BY founding_partner DESC, name`,
    )
    .all() as Record<string, unknown>[]
  const mapped = rows.map((r) => mapOrganization(r))
  const byCity = mapped.filter((o) => {
    const cities = o.serviceCityIds?.length ? o.serviceCityIds : [o.cityId]
    return cities.includes(cityId)
  })
  const pool = byCity.length ? byCity : mapped
  if (preferredOrgId) {
    const pref = pool.find((o) => o.id === preferredOrgId)
    if (pref) return [pref, ...pool.filter((o) => o.id !== preferredOrgId)].slice(0, 3)
  }
  // Limited competition: 1–3, prefer founding partners first
  return pool.slice(0, Math.min(3, Math.max(1, pool.length)))
}

function distributeLeadOffers(
  bookingId: string,
  cityId: string,
  preferredOrgId?: string,
  round = 1,
) {
  const targets = eligiblePartnerOrgs(cityId, preferredOrgId)
  const now = new Date()
  const deadline = new Date(now.getTime() + 2 * 3600000)
  const insert = db.prepare(`
    INSERT INTO lead_offers (
      id, booking_id, organization_id, status, offer_round, offered_at, deadline_at, responded_at
    ) VALUES (?, ?, ?, 'offered', ?, ?, ?, NULL)
  `)
  for (const org of targets.slice(0, preferredOrgId ? 1 : Math.min(3, targets.length))) {
    const offerId = uid('lo')
    insert.run(offerId, bookingId, org.id, round, now.toISOString(), deadline.toISOString())
    const owners = db
      .prepare(
        `SELECT user_id FROM organization_members WHERE organization_id = ? AND member_role IN ('owner','dispatcher') AND active = 1`,
      )
      .all(org.id) as { user_id: string }[]
    for (const m of owners) {
      notify({
        userId: m.user_id,
        type: 'lead_offer',
        titleEn: 'New lead offer — respond soon',
        titleAr: 'عرض عميل جديد — سارع بالرد',
        bodyEn: `Limited lead ${bookingId}. Deadline ${deadline.toISOString()}.`,
        bodyAr: `عرض محدود ${bookingId}. الموعد النهائي قريب.`,
        bookingId,
      })
    }
  }
  return targets.length
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'darfix' })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password, deviceLabel } = req.body as {
    email?: string
    password?: string
    deviceLabel?: string
  }
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  const row = db.prepare(`SELECT * FROM users WHERE lower(email) = lower(?)`).get(email) as
    | Record<string, unknown>
    | undefined
  if (!row || !bcrypt.compareSync(password, row.password_hash as string)) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  const isTech = row.role === 'technician'
  const priorSessions = isTech
    ? (
        db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE user_id = ? AND expires_at > ?`).get(
          row.id,
          new Date().toISOString(),
        ) as { c: number }
      ).c
    : 0
  const token = createSession(row.id as string, {
    deviceLabel,
    singleSession: isTech,
  })
  const user = mapUser(
    db.prepare(`SELECT * FROM users WHERE id = ?`).get(row.id as string) as Record<string, unknown>,
  )
  res.json({
    token,
    user,
    sessionNotice:
      isTech && priorSessions > 0
        ? 'Previous technician sessions were signed out (single-device seat policy).'
        : undefined,
  })
})

app.post('/api/auth/signup', (req, res) => {
  const { name, nameAr, email, phone, password, cityId, districtId } = req.body as {
    name?: string
    nameAr?: string
    email?: string
    phone?: string
    password?: string
    cityId?: string
    districtId?: string
  }
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  const exists = db.prepare(`SELECT id FROM users WHERE lower(email) = lower(?)`).get(email)
  if (exists) return res.status(409).json({ error: 'Email already registered' })
  const id = uid('cust')
  const phoneNorm = phone.startsWith('+') ? phone : `+966${phone.replace(/^0/, '')}`
  db.prepare(
    `INSERT INTO users (id, role, name, name_ar, email, phone, password_hash, city_id, district_id, active, avatar_color, created_at)
     VALUES (?, 'customer', ?, ?, ?, ?, ?, ?, ?, 1, '#14B8A6', ?)`,
  ).run(
    id,
    name,
    nameAr || name,
    email,
    phoneNorm,
    bcrypt.hashSync(password, 8),
    cityId ?? 'khobar',
    districtId ?? 'thuqbah',
    new Date().toISOString(),
  )
  const token = createSession(id)
  const user = mapUser(db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as Record<string, unknown>)
  res.status(201).json({ token, user })
})

/** Independent technician or maintenance company onboarding (+ capacity survey). */
app.post('/api/auth/signup/provider', (req, res) => {
  const body = req.body as {
    kind?: 'independent' | 'company'
    name?: string
    nameAr?: string
    email?: string
    phone?: string
    password?: string
    cityId?: string
    districtId?: string
    specialties?: string[]
    companyName?: string
    companyNameAr?: string
    commercialRegistration?: string
    licenseNumber?: string
    whatsapp?: string
    slaHours?: number
    techCount?: number
    serviceCityIds?: string[]
    priceApproverName?: string
    priceApproverPhone?: string
    // foundingPartner / trialDays intentionally ignored — client cannot self-elevate
  }
  const {
    kind,
    name,
    nameAr,
    email,
    phone,
    password,
    cityId = 'khobar',
    districtId,
    specialties = ['plumbing'],
    companyName,
    companyNameAr,
    commercialRegistration,
    licenseNumber,
    whatsapp,
    slaHours,
    techCount,
    serviceCityIds,
    priceApproverName,
    priceApproverPhone,
  } = body

  if (!kind || !name || !email || !phone || !password) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  if (kind === 'company' && !companyName) {
    return res.status(400).json({ error: 'Company name required' })
  }
  const exists = db.prepare(`SELECT id FROM users WHERE lower(email) = lower(?)`).get(email)
  if (exists) return res.status(409).json({ error: 'Email already registered' })

  const phoneNorm = phone.startsWith('+') ? phone : `+966${phone.replace(/^0/, '')}`
  const whatsappNorm = whatsapp
    ? whatsapp.startsWith('+')
      ? whatsapp
      : `+966${whatsapp.replace(/^0/, '')}`
    : phoneNorm
  const now = new Date().toISOString()
  const orgId = uid('org')
  const userId = kind === 'company' ? uid('prov') : uid('tech')
  const orgName = kind === 'company' ? companyName! : `${name} (Independent)`
  const orgNameAr =
    kind === 'company' ? companyNameAr || companyName! : `${nameAr || name} (مستقل)`
  const cities = serviceCityIds?.length ? serviceCityIds : [cityId]
  const survey = {
    services: specialties,
    cities,
    techCount: techCount ?? (kind === 'independent' ? 1 : undefined),
    slaHours: slaHours ?? undefined,
    commercialRegistration: commercialRegistration ?? undefined,
    whatsapp: whatsappNorm,
    priceApproverName: priceApproverName ?? undefined,
    priceApproverPhone: priceApproverPhone ?? undefined,
    completedAt: now,
  }
  // Server-only elevation via DARFIX_FOUNDING_EMAILS allowlist (never trust client body).
  const isFounding = isFoundingAllowlistedEmail(email)
  const trialDays = isFounding ? DEFAULT_TRIAL_DAYS : null
  const plan = isFounding ? 'pro' : 'launch'
  const trialEnd = isFounding ? trialEndsAt(new Date(), DEFAULT_TRIAL_DAYS) : null

  const create = db.transaction(() => {
    db.prepare(
      `INSERT INTO provider_organizations (
        id, kind, name, name_ar, city_id, phone, email,
        commercial_registration, license_number, status,
        subscription_plan, subscription_status, founding_partner, service_city_ids,
        trial_days, trial_ends_at, whatsapp, sla_hours, tech_count_declared,
        specialties, price_approver_name, price_approver_phone, onboarding_survey, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      orgId,
      kind,
      orgName,
      orgNameAr,
      cityId,
      phoneNorm,
      email,
      commercialRegistration ?? null,
      licenseNumber ?? null,
      plan,
      isFounding ? 'trialing' : 'none',
      isFounding ? 1 : 0,
      JSON.stringify(cities),
      isFounding ? trialDays : null,
      trialEnd,
      whatsappNorm,
      slaHours ?? null,
      techCount ?? (kind === 'independent' ? 1 : null),
      JSON.stringify(specialties),
      priceApproverName ?? null,
      priceApproverPhone ?? null,
      JSON.stringify(survey),
      now,
    )

    if (kind === 'company') {
      db.prepare(
        `INSERT INTO users (
          id, role, name, name_ar, email, phone, password_hash, city_id, district_id,
          active, avatar_color, employment_type, organization_id, last_active_at, created_at
        ) VALUES (?, 'provider', ?, ?, ?, ?, ?, ?, ?, 1, '#0F766E', 'company', ?, ?, ?)`,
      ).run(
        userId,
        name,
        nameAr || name,
        email,
        phoneNorm,
        bcrypt.hashSync(password, 8),
        cityId,
        districtId ?? null,
        orgId,
        now,
        now,
      )
      db.prepare(
        `INSERT INTO organization_members (id, organization_id, user_id, member_role, active, created_at)
         VALUES (?, ?, ?, 'owner', 1, ?)`,
      ).run(uid('mem'), orgId, userId, now)
    } else {
      const techCode = nextTechnicianCode(cityId)
      db.prepare(
        `INSERT INTO users (
          id, role, name, name_ar, email, phone, password_hash, city_id, district_id,
          specialties, rating, review_count, active, avatar_color, employment_type, organization_id,
          technician_code, last_active_at, created_at
        ) VALUES (?, 'technician', ?, ?, ?, ?, ?, ?, ?, ?, 5.0, 0, 1, '#0B3A4A', 'independent', ?, ?, ?, ?)`,
      ).run(
        userId,
        name,
        nameAr || name,
        email,
        phoneNorm,
        bcrypt.hashSync(password, 8),
        cityId,
        districtId ?? null,
        JSON.stringify(specialties),
        orgId,
        techCode,
        now,
        now,
      )
      db.prepare(
        `INSERT INTO organization_members (id, organization_id, user_id, member_role, active, created_at)
         VALUES (?, ?, ?, 'owner', 1, ?)`,
      ).run(uid('mem'), orgId, userId, now)
    }
  })

  create()
  const token = createSession(userId, { singleSession: kind === 'independent' })
  const user = mapUser(db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as Record<string, unknown>)
  const organization = mapOrganization(
    db.prepare(`SELECT * FROM provider_organizations WHERE id = ?`).get(orgId) as Record<string, unknown>,
  )
  res.status(201).json({ token, user, organization })
})

app.post('/api/auth/logout', auth, (req: Authed, res) => {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : ''
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token)
  res.json({ ok: true })
})

app.get('/api/bootstrap', auth, (req: Authed, res) => {
  const locale = (req.query.locale as 'en' | 'ar') || 'en'
  res.json(loadBootstrap(req.userId!, req.userRole!, locale))
})

app.patch('/api/locale', auth, (req: Authed, res) => {
  const locale = (req.body as { locale?: 'en' | 'ar' }).locale || 'en'
  res.json(loadBootstrap(req.userId!, req.userRole!, locale))
})

app.post('/api/demo/reset', auth, (req: Authed, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' })
  if (isProdLike() || !demoSeedEnabled()) {
    return res.status(403).json({ error: 'Demo reset disabled (requires DARFIX_SEED_DEMO=1, not production)' })
  }
  seedIfEmpty(true)
  const admin = db.prepare(`SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1`).get() as
    | { id: string }
    | undefined
  if (!admin) return res.status(500).json({ error: 'Demo seed failed' })
  const token = createSession(admin.id)
  // Never return passwords — only a fresh session + bootstrap state.
  res.json({ token, state: loadBootstrap(admin.id, 'admin', 'en') })
})

app.get('/api/fees/:categoryId/:problemId', (_req, res) => {
  const { categoryId, problemId } = _req.params
  res.json({ baseFeeSar: getEffectiveFee(categoryId, problemId) })
})

app.post('/api/bookings', auth, (req: Authed, res) => {
  if (req.userRole !== 'customer') return res.status(403).json({ error: 'Customers only' })
  const body = req.body as {
    categoryId: string
    problemId: string
    description: string
    photos?: unknown[]
    address: Record<string, unknown>
    preferredDate: string
    preferredTimeSlot: string
    discountCode?: string
    preferredOrganizationId?: string
  }
  let fee = getEffectiveFee(body.categoryId, body.problemId)
  let discountAmount = 0
  let usedCode: string | undefined
  if (body.discountCode) {
    const dc = db
      .prepare(`SELECT * FROM discount_codes WHERE upper(code) = upper(?) AND active = 1`)
      .get(body.discountCode) as
      | { code: string; percent_off: number; used_count: number; max_uses: number }
      | undefined
    if (dc && dc.used_count < dc.max_uses) {
      discountAmount = Math.round((fee * dc.percent_off) / 100)
      fee -= discountAmount
      usedCode = dc.code
      db.prepare(`UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?`).run(dc.code)
    }
  }

  const id = uid('bk')
  const now = new Date().toISOString()
  const costs = [
    { id: uid('cost'), label: 'Service call', amountSar: fee + discountAmount, type: 'fee' },
    ...(discountAmount
      ? [{ id: uid('cost'), label: `Discount (${usedCode})`, amountSar: -discountAmount, type: 'discount' }]
      : []),
  ]
  const cityId = (body.address?.cityId as string) || 'khobar'
  const process: BookingProcess = {
    ...emptyProcess(),
    workChecklist: defaultChecklist(body.categoryId),
    currentStepNote: 'Request received — matching partner companies (limited offers)',
  }

  db.prepare(
    `INSERT INTO bookings (
      id, customer_id, preferred_organization_id, category_id, problem_id, description, photos, address,
      preferred_date, preferred_time_slot, estimated_fee_sar, status, costs, extra_work,
      discount_code, discount_amount_sar, process, status_history, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new_request', ?, '[]', ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    req.userId,
    body.preferredOrganizationId ?? null,
    body.categoryId,
    body.problemId,
    body.description,
    JSON.stringify(body.photos || []),
    JSON.stringify(body.address),
    body.preferredDate,
    body.preferredTimeSlot,
    fee,
    JSON.stringify(costs),
    usedCode ?? null,
    discountAmount || null,
    JSON.stringify(process),
    JSON.stringify([{ status: 'new_request', at: now }]),
    now,
    now,
  )

  distributeLeadOffers(id, cityId, body.preferredOrganizationId)

  notify({
    userId: req.userId!,
    type: 'booking_confirmed',
    titleEn: 'Request submitted to partner companies',
    titleAr: 'تم إرسال الطلب لشركات شريكة',
    bodyEn: `Your ${body.categoryId} request ${id} was matched to a limited set of partners.`,
    bodyAr: `تم مطابقة طلبك ${id} مع مجموعة محدودة من الشركاء.`,
    bookingId: id,
  })
  for (const admin of db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all() as { id: string }[]) {
    notify({
      userId: admin.id,
      type: 'general',
      titleEn: 'New marketplace request',
      titleAr: 'طلب سوق جديد',
      bodyEn: `New ${body.categoryId} booking ${id} — lead offers distributed`,
      bodyAr: `حجز جديد ${id} — تم توزيع العروض`,
      bookingId: id,
    })
  }

  const booking = mapBooking(db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(id) as Record<string, unknown>)
  res.status(201).json({ booking })
})

app.patch('/api/bookings/:id/status', auth, (req: Authed, res) => {
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!requireBookingAccess(req, res, booking, 'status')) return
  // Customers may only cancel their own booking via this route
  const { status, note } = req.body as { status: BookingStatus; note?: string }
  if (req.userRole === 'customer' && status !== 'cancelled') {
    return res.status(403).json({ error: 'Customers may only cancel' })
  }
  const now = new Date().toISOString()
  const history = JSON.parse((booking.status_history as string) || '[]') as {
    status: string
    at: string
    by?: string
    note?: string
  }[]
  history.push({ status, at: now, by: req.userId, note })

  let process: BookingProcess = {
    ...emptyProcess(),
    ...JSON.parse((booking.process as string) || '{}'),
  }
  if (status === 'on_the_way') {
    process.estimatedArrival = new Date(Date.now() + 30 * 60000).toISOString()
    process.currentStepNote = note || 'Technician is on the way'
  }
  if (status === 'arrived') {
    process.arrivedAt = now
    process.currentStepNote = note || 'Technician arrived on site'
  }
  if (status === 'in_progress') {
    process.startedAt = process.startedAt || now
    process.currentStepNote = note || 'Work in progress'
  }
  if (status === 'completed') {
    process.completedAt = now
    process.currentStepNote = 'Job completed'
    process.workChecklist = (process.workChecklist || []).map((c) => ({ ...c, done: true }))
  }
  if (status === 'awaiting_approval') {
    process.currentStepNote = note || 'Awaiting customer approval for extra work'
  }
  if (status === 'confirmed') {
    process.currentStepNote = 'Booking confirmed — assigning technician soon'
  }
  if (status === 'technician_assigned') {
    process.currentStepNote = 'Technician assigned'
  }
  if (status === 'cancelled') {
    process.currentStepNote = 'Booking cancelled'
  }

  db.prepare(
    `UPDATE bookings SET status = ?, status_history = ?, process = ?, updated_at = ? WHERE id = ?`,
  ).run(status, JSON.stringify(history), JSON.stringify(process), now, req.params.id)

  const customerId = booking.customer_id as string
  if (status === 'confirmed') {
    notify({
      userId: customerId,
      type: 'booking_confirmed',
      titleEn: 'Booking confirmed',
      titleAr: 'تم تأكيد الحجز',
      bodyEn: `Booking ${req.params.id} is confirmed.`,
      bodyAr: `تم تأكيد الحجز ${req.params.id}.`,
      bookingId: req.params.id,
    })
  }
  if (status === 'on_the_way') {
    notify({
      userId: customerId,
      type: 'on_the_way',
      titleEn: 'Technician on the way',
      titleAr: 'الفني في الطريق',
      bodyEn: `Your technician is heading to you for ${req.params.id}.`,
      bodyAr: `الفني في الطريق إليك للحجز ${req.params.id}.`,
      bookingId: req.params.id,
    })
  }
  if (status === 'completed') {
    notify({
      userId: customerId,
      type: 'job_completed',
      titleEn: 'Job completed',
      titleAr: 'اكتملت المهمة',
      bodyEn: `Booking ${req.params.id} is complete. Please rate your experience.`,
      bodyAr: `اكتمل الحجز ${req.params.id}. يرجى تقييم تجربتك.`,
      bookingId: req.params.id,
    })
    const costs = JSON.parse((booking.costs as string) || '[]') as { amountSar: number }[]
    const total = costs.reduce((s, c) => s + c.amountSar, 0)
    db.prepare(
      `INSERT INTO invoices (id, booking_id, customer_id, lines, total_sar, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'unpaid', ?)`,
    ).run(uid('inv'), req.params.id, customerId, booking.costs, total, now)
  }

  res.json({
    booking: mapBooking(
      db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

app.post('/api/bookings/:id/assign', auth, (req: Authed, res) => {
  const { technicianId, organizationId, allowReassign } = req.body as {
    technicianId?: string
    organizationId?: string
    allowReassign?: boolean
  }
  if (!technicianId && !organizationId) {
    return res.status(400).json({ error: 'technicianId or organizationId required' })
  }

  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!requireBookingAccess(req, res, booking, 'assign')) return

  const isAdmin = req.userRole === 'admin'
  const isProvider = req.userRole === 'provider'

  if (isProvider) {
    const myOrg = userOrgId(req.userId!)
    if (organizationId && organizationId !== myOrg) {
      return res.status(403).json({ error: 'Cannot assign outside your organization' })
    }
  }

  let tech: Record<string, unknown> | undefined
  let org: Record<string, unknown> | undefined
  let mode: 'named_tech' | 'company_pool' = 'named_tech'
  let resolvedOrgId = organizationId
  let resolvedTechId = technicianId ?? null
  let stepNote = ''

  if (technicianId) {
    tech = db
      .prepare(`SELECT * FROM users WHERE id = ? AND role = 'technician'`)
      .get(technicianId) as Record<string, unknown> | undefined
    if (!tech) return res.status(404).json({ error: 'Technician not found' })
    if (isProvider && tech.organization_id !== userOrgId(req.userId!)) {
      return res.status(403).json({ error: 'Technician not in your organization' })
    }
    resolvedOrgId = (tech.organization_id as string) || organizationId
    mode = 'named_tech'
    stepNote = `Assigned to ${tech.name} — awaiting accept/reject`
  }

  if (organizationId && !technicianId) {
    org = db.prepare(`SELECT * FROM provider_organizations WHERE id = ?`).get(organizationId) as
      | Record<string, unknown>
      | undefined
    if (!org) return res.status(404).json({ error: 'Organization not found' })
    if (org.kind === 'independent') {
      const ownerTech = db
        .prepare(
          `SELECT u.* FROM users u
           JOIN organization_members m ON m.user_id = u.id
           WHERE m.organization_id = ? AND u.role = 'technician' AND m.active = 1
           LIMIT 1`,
        )
        .get(organizationId) as Record<string, unknown> | undefined
      if (!ownerTech) return res.status(404).json({ error: 'Independent tech not found' })
      tech = ownerTech
      resolvedTechId = ownerTech.id as string
      mode = 'named_tech'
      stepNote = `Assigned to independent tech ${ownerTech.name}`
    } else {
      mode = 'company_pool'
      resolvedTechId = null
      stepNote = `Assigned to company pool: ${org.name}`
    }
  } else if (resolvedOrgId) {
    org = db.prepare(`SELECT * FROM provider_organizations WHERE id = ?`).get(resolvedOrgId) as
      | Record<string, unknown>
      | undefined
  }

  if (
    booking.technician_id &&
    resolvedTechId &&
    booking.technician_id !== resolvedTechId &&
    !allowReassign
  ) {
    return res.status(409).json({
      error: 'Reassignment requires shift-lead approval',
      code: 'requires_approval',
      action: 'reassign_technician',
      currentTechnicianId: booking.technician_id,
    })
  }

  const now = new Date().toISOString()
  const history = JSON.parse((booking.status_history as string) || '[]') as object[]
  const nextStatus = resolvedTechId ? 'technician_assigned' : 'confirmed'
  history.push({
    status: nextStatus,
    at: now,
    by: req.userId,
    note: stepNote,
  })
  const prevProcess = JSON.parse((booking.process as string) || '{}') as BookingProcess
  const process: BookingProcess = {
    ...emptyProcess(),
    ...prevProcess,
    workChecklist:
      prevProcess.workChecklist?.length
        ? prevProcess.workChecklist
        : defaultChecklist(booking.category_id as string),
    currentStepNote: stepNote,
  }

  db.prepare(
    `UPDATE bookings SET technician_id = ?, organization_id = ?, assignment_mode = ?,
     tech_response = ?, status = ?, status_history = ?, process = ?, updated_at = ? WHERE id = ?`,
  ).run(
    resolvedTechId,
    resolvedOrgId ?? null,
    mode,
    resolvedTechId ? 'pending' : null,
    nextStatus,
    JSON.stringify(history),
    JSON.stringify(process),
    now,
    req.params.id,
  )

  if (resolvedTechId && tech) {
    notify({
      userId: booking.customer_id as string,
      type: 'technician_assigned',
      titleEn: 'Technician assigned',
      titleAr: 'تم تعيين فني',
      bodyEn: `${tech.name} has been assigned to booking ${req.params.id}.`,
      bodyAr: `تم تعيين ${tech.name_ar} للحجز ${req.params.id}.`,
      bookingId: req.params.id,
    })
    notify({
      userId: resolvedTechId,
      type: 'general',
      titleEn: 'New job assigned',
      titleAr: 'مهمة جديدة',
      bodyEn: `You were assigned booking ${req.params.id}.`,
      bodyAr: `تم تعيين الحجز ${req.params.id} لك.`,
      bookingId: req.params.id,
    })
  } else if (org) {
    notify({
      userId: booking.customer_id as string,
      type: 'booking_confirmed',
      titleEn: 'Provider company assigned',
      titleAr: 'تم تعيين شركة صيانة',
      bodyEn: `${org.name} will handle booking ${req.params.id} — a technician will be named soon.`,
      bodyAr: `ستتولى ${org.name_ar} الحجز ${req.params.id} — سيتم تعيين فني قريباً.`,
      bookingId: req.params.id,
    })
    const owners = db
      .prepare(
        `SELECT user_id FROM organization_members WHERE organization_id = ? AND member_role = 'owner' AND active = 1`,
      )
      .all(resolvedOrgId) as { user_id: string }[]
    for (const o of owners) {
      notify({
        userId: o.user_id,
        type: 'general',
        titleEn: 'New pool job',
        titleAr: 'مهمة جديدة للمجموعة',
        bodyEn: `Booking ${req.params.id} was added to your company pool.`,
        bodyAr: `أُضيف الحجز ${req.params.id} إلى مجموعة شركتك.`,
        bookingId: req.params.id,
      })
    }
  }

  res.json({
    booking: mapBooking(
      db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

app.post('/api/bookings/:id/photos', auth, (req: Authed, res) => {
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!requireBookingAccess(req, res, booking, 'photos')) return
  const photos = JSON.parse((booking.photos as string) || '[]') as unknown[]
  const incoming = (req.body as { photos: unknown[] }).photos || []
  const next = [...photos, ...incoming]
  db.prepare(`UPDATE bookings SET photos = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify(next),
    new Date().toISOString(),
    req.params.id,
  )
  res.json({
    booking: mapBooking(
      db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

app.post('/api/bookings/:id/costs', auth, (req: Authed, res) => {
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!requireBookingAccess(req, res, booking, 'costs')) return
  const costs = JSON.parse((booking.costs as string) || '[]') as unknown[]
  const sanitized = sanitizeCostLines((req.body as { costs: unknown[] }).costs || [])
  if (!sanitized.ok) return res.status(400).json({ error: sanitized.error })
  // Admins may append validated lines as-is; field roles already constrained in sanitizeCostLines.
  db.prepare(`UPDATE bookings SET costs = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify([...costs, ...sanitized.lines]),
    new Date().toISOString(),
    req.params.id,
  )
  res.json({
    booking: mapBooking(
      db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

app.post('/api/bookings/:id/report', auth, (req: Authed, res) => {
  const { report } = req.body as { report: string }
  const now = new Date().toISOString()
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!requireBookingAccess(req, res, booking, 'report')) return
  const history = JSON.parse((booking.status_history as string) || '[]') as object[]
  history.push({ status: 'completed', at: now, by: req.userId })
  const process: BookingProcess = {
    ...emptyProcess(),
    ...JSON.parse((booking.process as string) || '{}'),
    completedAt: now,
    currentStepNote: 'Job completed',
    workChecklist: (JSON.parse((booking.process as string) || '{}').workChecklist || []).map(
      (c: { id: string; label: string; done: boolean }) => ({ ...c, done: true }),
    ),
  }
  db.prepare(
    `UPDATE bookings SET job_report = ?, status = 'completed', status_history = ?, process = ?, updated_at = ? WHERE id = ?`,
  ).run(report, JSON.stringify(history), JSON.stringify(process), now, req.params.id)

  const costs = JSON.parse((booking.costs as string) || '[]') as { amountSar: number }[]
  const total = costs.reduce((s, c) => s + c.amountSar, 0)
  db.prepare(
    `INSERT INTO invoices (id, booking_id, customer_id, lines, total_sar, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'unpaid', ?)`,
  ).run(uid('inv'), req.params.id, booking.customer_id, booking.costs, total, now)

  notify({
    userId: booking.customer_id as string,
    type: 'job_completed',
    titleEn: 'Job completed',
    titleAr: 'اكتملت المهمة',
    bodyEn: `Booking ${req.params.id} is complete.`,
    bodyAr: `اكتمل الحجز ${req.params.id}.`,
    bookingId: req.params.id,
  })

  res.json({
    booking: mapBooking(
      db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

app.post('/api/bookings/:id/extra-work', auth, (req: Authed, res) => {
  const { description, amountSar } = req.body as { description: string; amountSar: number }
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!requireBookingAccess(req, res, booking, 'extra_work')) return
  const now = new Date().toISOString()
  const extra = JSON.parse((booking.extra_work as string) || '[]') as object[]
  extra.push({ id: uid('ew'), description, amountSar, status: 'pending', createdAt: now })
  const history = JSON.parse((booking.status_history as string) || '[]') as object[]
  history.push({ status: 'awaiting_approval', at: now, by: req.userId })
  const process: BookingProcess = {
    ...emptyProcess(),
    ...JSON.parse((booking.process as string) || '{}'),
    currentStepNote: `Extra work pending: ${description}`,
  }
  db.prepare(
    `UPDATE bookings SET extra_work = ?, status = 'awaiting_approval', status_history = ?, process = ?, updated_at = ? WHERE id = ?`,
  ).run(JSON.stringify(extra), JSON.stringify(history), JSON.stringify(process), now, req.params.id)
  notify({
    userId: booking.customer_id as string,
    type: 'extra_work',
    titleEn: 'Extra work approval needed',
    titleAr: 'مطلوب الموافقة على عمل إضافي',
    bodyEn: `Approve additional work: ${description} (SAR ${amountSar})`,
    bodyAr: `وافق على عمل إضافي: ${description} (${amountSar} ر.س)`,
    bookingId: req.params.id,
  })
  res.json({
    booking: mapBooking(
      db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

app.post('/api/bookings/:id/extra-work/:extraId/respond', auth, (req: Authed, res) => {
  const { approve } = req.body as { approve: boolean }
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!requireBookingAccess(req, res, booking, 'extra_work_respond')) return
  const extra = JSON.parse((booking.extra_work as string) || '[]') as {
    id: string
    description: string
    amountSar: number
    status: string
  }[]
  const item = extra.find((e) => e.id === req.params.extraId)
  if (!item) return res.status(404).json({ error: 'Extra work not found' })
  item.status = approve ? 'approved' : 'rejected'
  let costs = JSON.parse((booking.costs as string) || '[]') as object[]
  if (approve) {
    costs = [
      ...costs,
      { id: uid('cost'), label: item.description, amountSar: item.amountSar, type: 'materials' },
    ]
  }
  const process: BookingProcess = {
    ...emptyProcess(),
    ...JSON.parse((booking.process as string) || '{}'),
    currentStepNote: approve ? 'Extra work approved — continuing' : 'Extra work rejected — continuing',
  }
  db.prepare(
    `UPDATE bookings SET extra_work = ?, costs = ?, status = 'in_progress', process = ?, updated_at = ? WHERE id = ?`,
  ).run(
    JSON.stringify(extra),
    JSON.stringify(costs),
    JSON.stringify(process),
    new Date().toISOString(),
    req.params.id,
  )
  res.json({
    booking: mapBooking(
      db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

app.post('/api/bookings/:id/rate', auth, (req: Authed, res) => {
  const { rating, reviewText } = req.body as { rating: number; reviewText: string }
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!requireBookingAccess(req, res, booking, 'rate')) return
  if (!booking.technician_id) return res.status(404).json({ error: 'Not found' })
  const now = new Date().toISOString()
  db.prepare(
    `UPDATE bookings SET rating = ?, review_text = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
  ).run(rating, reviewText, now, now, req.params.id)

  const tech = db.prepare(`SELECT * FROM users WHERE id = ?`).get(booking.technician_id) as {
    rating: number | null
    review_count: number
  }
  const count = (tech.review_count || 0) + 1
  const prev = (tech.rating || 0) * (tech.review_count || 0)
  const nextRating = Math.round(((prev + rating) / count) * 10) / 10
  db.prepare(`UPDATE users SET rating = ?, review_count = ? WHERE id = ?`).run(
    nextRating,
    count,
    booking.technician_id,
  )

  res.json({
    booking: mapBooking(
      db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

app.post('/api/bookings/:id/process/note', auth, (req: Authed, res) => {
  const { text } = req.body as { text: string }
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!requireBookingAccess(req, res, booking, 'process')) return
  const process: BookingProcess = {
    ...emptyProcess(),
    ...JSON.parse((booking.process as string) || '{}'),
  }
  process.technicianNotes = [
    ...(process.technicianNotes || []),
    { id: uid('pn'), at: new Date().toISOString(), text, authorId: req.userId! },
  ]
  process.currentStepNote = text
  db.prepare(`UPDATE bookings SET process = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify(process),
    new Date().toISOString(),
    req.params.id,
  )
  res.json({
    booking: mapBooking(
      db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

app.patch('/api/bookings/:id/process/checklist', auth, (req: Authed, res) => {
  const { itemId, done } = req.body as { itemId: string; done: boolean }
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!requireBookingAccess(req, res, booking, 'process')) return
  const process: BookingProcess = {
    ...emptyProcess(),
    ...JSON.parse((booking.process as string) || '{}'),
  }
  process.workChecklist = (process.workChecklist || []).map((c) =>
    c.id === itemId ? { ...c, done } : c,
  )
  const doneCount = process.workChecklist.filter((c) => c.done).length
  process.currentStepNote = `Checklist ${doneCount}/${process.workChecklist.length} complete`
  db.prepare(`UPDATE bookings SET process = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify(process),
    new Date().toISOString(),
    req.params.id,
  )
  res.json({
    booking: mapBooking(
      db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

app.post('/api/notifications/:id/read', auth, (req: Authed, res) => {
  db.prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`).run(
    req.params.id,
    req.userId,
  )
  res.json({ ok: true })
})

app.post('/api/notifications/read-all', auth, (req: Authed, res) => {
  db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`).run(req.userId)
  res.json({ ok: true })
})

app.post('/api/invoices/:id/pay', auth, async (req: Authed, res) => {
  // Mock mark-paid only — refuse on hosted/pilot unless DARFIX_ALLOW_MOCK_PAY=1
  if (!allowMockPayments()) {
    return res.status(403).json({ error: 'Mock invoice pay disabled — use the payment gateway' })
  }
  const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!invoice) return res.status(404).json({ error: 'Not found' })
  if (invoice.customer_id !== req.userId && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const now = new Date().toISOString()
  db.prepare(`UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?`).run(now, req.params.id)
  res.json({
    invoice: mapInvoice(
      db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

app.post('/api/quotations', auth, (req: Authed, res) => {
  if (!['admin', 'technician', 'provider'].includes(req.userRole || '')) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const { bookingId, lines } = req.body as {
    bookingId: string
    lines: { id: string; label: string; amountSar: number; type: string }[]
  }
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(bookingId) as
    | Record<string, unknown>
    | undefined
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  if (req.userRole === 'technician' && booking.technician_id !== req.userId) {
    return res.status(403).json({ error: 'Not your job' })
  }
  if (req.userRole === 'provider') {
    const orgId = userOrgId(req.userId!)
    if (booking.organization_id !== orgId) return res.status(403).json({ error: 'Forbidden' })
  }

  const id = uid('q')
  const total = lines.reduce((s, l) => s + l.amountSar, 0)
  const now = new Date().toISOString()
  // Technician quotes need company price approval; admin/provider can send directly
  const status =
    req.userRole === 'technician' && booking.organization_id
      ? 'pending_company_approval'
      : 'sent'
  db.prepare(
    `INSERT INTO quotations (id, booking_id, lines, total_sar, status, created_at, submitted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, bookingId, JSON.stringify(lines), total, status, now, req.userId)

  if (status === 'pending_company_approval' && booking.organization_id) {
    const owners = db
      .prepare(
        `SELECT user_id FROM organization_members WHERE organization_id = ? AND member_role IN ('owner','dispatcher') AND active = 1`,
      )
      .all(booking.organization_id as string) as { user_id: string }[]
    for (const m of owners) {
      notify({
        userId: m.user_id,
        type: 'quotation',
        titleEn: 'Quote needs price approval',
        titleAr: 'عرض سعر بانتظار موافقة التسعير',
        bodyEn: `Technician submitted quote on ${bookingId}: SAR ${total}`,
        bodyAr: `قدّم الفني عرض سعر على ${bookingId}: ${total} ر.س`,
        bookingId,
      })
    }
  } else {
    notify({
      userId: booking.customer_id as string,
      type: 'quotation',
      titleEn: 'New quotation',
      titleAr: 'عرض سعر جديد',
      bodyEn: `Quotation for ${bookingId}: SAR ${total}`,
      bodyAr: `عرض سعر للحجز ${bookingId}: ${total} ر.س`,
      bookingId,
    })
  }
  res.status(201).json({
    quotation: mapQuotation(
      db.prepare(`SELECT * FROM quotations WHERE id = ?`).get(id) as Record<string, unknown>,
    ),
  })
})

/** Company approver: approve / reject / clarify a technician quote before customer sees it. */
app.post('/api/quotations/:id/company-review', auth, (req: Authed, res) => {
  if (req.userRole !== 'provider' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const { decision, note } = req.body as {
    decision: 'approve' | 'reject' | 'clarify'
    note?: string
  }
  const quote = db.prepare(`SELECT * FROM quotations WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!quote) return res.status(404).json({ error: 'Not found' })
  if (quote.status !== 'pending_company_approval' && quote.status !== 'clarification_requested') {
    return res.status(409).json({ error: 'Quote not awaiting company review' })
  }
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(quote.booking_id as string) as
    | Record<string, unknown>
    | undefined
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  if (req.userRole === 'provider') {
    const orgId = userOrgId(req.userId!)
    if (booking.organization_id !== orgId) return res.status(403).json({ error: 'Forbidden' })
  }

  const nextStatus =
    decision === 'approve' ? 'sent' : decision === 'reject' ? 'company_rejected' : 'clarification_requested'
  db.prepare(`UPDATE quotations SET status = ?, company_note = ? WHERE id = ?`).run(
    nextStatus,
    note ?? null,
    req.params.id,
  )

  if (nextStatus === 'sent') {
    notify({
      userId: booking.customer_id as string,
      type: 'quotation',
      titleEn: 'Approved quotation ready',
      titleAr: 'عرض سعر معتمد جاهز',
      bodyEn: `Partner-approved quote for ${booking.id}: SAR ${quote.total_sar}`,
      bodyAr: `عرض سعر معتمد للحجز ${booking.id}: ${quote.total_sar} ر.س`,
      bookingId: booking.id as string,
    })
  } else if (booking.technician_id) {
    notify({
      userId: booking.technician_id as string,
      type: 'quotation',
      titleEn: decision === 'reject' ? 'Quote rejected by company' : 'Clarify quote',
      titleAr: decision === 'reject' ? 'رفضت الشركة عرض السعر' : 'مطلوب توضيح عرض السعر',
      bodyEn: note || `Company ${decision}d quote ${req.params.id}`,
      bodyAr: note || `قرار الشركة بشأن العرض ${req.params.id}`,
      bookingId: booking.id as string,
    })
  }

  res.json({
    quotation: mapQuotation(
      db.prepare(`SELECT * FROM quotations WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

app.post('/api/quotations/:id/customer-respond', auth, (req: Authed, res) => {
  if (req.userRole !== 'customer') return res.status(403).json({ error: 'Customers only' })
  const { approve } = req.body as { approve: boolean }
  const quote = db.prepare(`SELECT * FROM quotations WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!quote) return res.status(404).json({ error: 'Not found' })
  if (quote.status !== 'sent') return res.status(409).json({ error: 'Quote not available' })
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(quote.booking_id as string) as
    | Record<string, unknown>
    | undefined
  if (!booking || booking.customer_id !== req.userId) return res.status(403).json({ error: 'Forbidden' })

  const status = approve ? 'accepted' : 'rejected'
  db.prepare(`UPDATE quotations SET status = ? WHERE id = ?`).run(status, req.params.id)
  if (approve) {
    const lines = JSON.parse(quote.lines as string) as {
      id: string
      label: string
      amountSar: number
      type: string
    }[]
    db.prepare(`UPDATE bookings SET costs = ?, updated_at = ? WHERE id = ?`).run(
      JSON.stringify(lines),
      new Date().toISOString(),
      booking.id,
    )
  }
  res.json({
    quotation: mapQuotation(
      db.prepare(`SELECT * FROM quotations WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

/** Provider accepts/rejects a limited lead offer. */
app.post('/api/lead-offers/:id/respond', auth, (req: Authed, res) => {
  if (req.userRole !== 'provider' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const { accept } = req.body as { accept: boolean }
  const offer = db.prepare(`SELECT * FROM lead_offers WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!offer) return res.status(404).json({ error: 'Not found' })
  if (offer.status !== 'offered') return res.status(409).json({ error: 'Offer not open' })
  if (req.userRole === 'provider' && offer.organization_id !== userOrgId(req.userId!)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const now = new Date().toISOString()
  if (new Date(offer.deadline_at as string).getTime() < Date.now()) {
    db.prepare(`UPDATE lead_offers SET status = 'expired' WHERE id = ?`).run(req.params.id)
    return res.status(409).json({ error: 'Offer expired' })
  }

  if (accept) {
    db.prepare(
      `UPDATE lead_offers SET status = 'accepted', responded_at = ? WHERE id = ?`,
    ).run(now, req.params.id)
    // Expire sibling open offers for this booking (exclusive win among limited set)
    db.prepare(
      `UPDATE lead_offers SET status = 'expired' WHERE booking_id = ? AND id != ? AND status = 'offered'`,
    ).run(offer.booking_id, req.params.id)

    const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(offer.booking_id as string) as
      | Record<string, unknown>
      | undefined
    if (booking) {
      const history = JSON.parse((booking.status_history as string) || '[]') as object[]
      history.push({ status: 'confirmed', at: now, by: req.userId, note: 'Partner accepted lead' })
      const process = {
        ...emptyProcess(),
        ...(JSON.parse((booking.process as string) || '{}') as BookingProcess),
        currentStepNote: 'Partner company accepted lead — assign a technician',
      }
      db.prepare(
        `UPDATE bookings SET organization_id = ?, assignment_mode = 'company_pool', status = 'confirmed',
         status_history = ?, process = ?, updated_at = ? WHERE id = ?`,
      ).run(
        offer.organization_id,
        JSON.stringify(history),
        JSON.stringify(process),
        now,
        offer.booking_id,
      )
      notify({
        userId: booking.customer_id as string,
        type: 'booking_confirmed',
        titleEn: 'Partner company matched',
        titleAr: 'تم مطابقة شركة شريكة',
        bodyEn: `A partner company accepted your request ${booking.id}.`,
        bodyAr: `قبلت شركة شريكة طلبك ${booking.id}.`,
        bookingId: booking.id as string,
      })
    }
  } else {
    db.prepare(
      `UPDATE lead_offers SET status = 'rejected', responded_at = ? WHERE id = ?`,
    ).run(now, req.params.id)

    const openLeft = db
      .prepare(
        `SELECT COUNT(*) as c FROM lead_offers WHERE booking_id = ? AND status = 'offered'`,
      )
      .get(offer.booking_id) as { c: number }
    if (openLeft.c === 0) {
      // Expand to next eligible orgs not yet offered
      const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(offer.booking_id as string) as
        | Record<string, unknown>
        | undefined
      if (booking) {
        const addr = JSON.parse(booking.address as string) as { cityId: string }
        const already = new Set(
          (
            db
              .prepare(`SELECT organization_id FROM lead_offers WHERE booking_id = ?`)
              .all(offer.booking_id) as { organization_id: string }[]
          ).map((r) => r.organization_id),
        )
        const round = ((offer.offer_round as number) || 1) + 1
        const next = eligiblePartnerOrgs(addr.cityId).filter((o) => !already.has(o.id)).slice(0, 2)
        if (next.length) {
          const deadline = new Date(Date.now() + 2 * 3600000).toISOString()
          for (const org of next) {
            db.prepare(
              `INSERT INTO lead_offers (id, booking_id, organization_id, status, offer_round, offered_at, deadline_at)
               VALUES (?, ?, ?, 'offered', ?, ?, ?)`,
            ).run(uid('lo'), offer.booking_id, org.id, round, now, deadline)
            db.prepare(
              `UPDATE lead_offers SET status = 'expanded' WHERE booking_id = ? AND status = 'rejected'`,
            ).run(offer.booking_id)
          }
        }
      }
    }
  }

  res.json({
    offer: mapLeadOffer(
      db.prepare(`SELECT * FROM lead_offers WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
    booking: mapBooking(
      db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(offer.booking_id as string) as Record<
        string,
        unknown
      >,
    ),
  })
})

/** Technician accept/reject named assignment. */
app.post('/api/bookings/:id/tech-respond', auth, (req: Authed, res) => {
  if (req.userRole !== 'technician') return res.status(403).json({ error: 'Technicians only' })
  const { accept } = req.body as { accept: boolean }
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!requireBookingAccess(req, res, booking, 'tech_respond')) return

  const now = new Date().toISOString()
  if (accept) {
    db.prepare(
      `UPDATE bookings SET tech_response = 'accepted', updated_at = ? WHERE id = ?`,
    ).run(now, req.params.id)
  } else {
    const history = JSON.parse((booking.status_history as string) || '[]') as object[]
    history.push({ status: booking.status, at: now, by: req.userId, note: 'Technician rejected assignment' })
    db.prepare(
      `UPDATE bookings SET technician_id = NULL, tech_response = 'rejected', assignment_mode = 'company_pool',
       status = 'confirmed', status_history = ?, updated_at = ? WHERE id = ?`,
    ).run(JSON.stringify(history), now, req.params.id)
    if (booking.organization_id) {
      const owners = db
        .prepare(
          `SELECT user_id FROM organization_members WHERE organization_id = ? AND member_role IN ('owner','dispatcher')`,
        )
        .all(booking.organization_id as string) as { user_id: string }[]
      for (const m of owners) {
        notify({
          userId: m.user_id,
          type: 'general',
          titleEn: 'Technician declined job',
          titleAr: 'رفض الفني المهمة',
          bodyEn: `Job ${req.params.id} returned to company pool.`,
          bodyAr: `عادت المهمة ${req.params.id} إلى مجموعة الشركة.`,
          bookingId: req.params.id,
        })
      }
    }
  }
  res.json({
    booking: mapBooking(
      db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

/** GPS disclosure stub during active jobs. */
app.post('/api/bookings/:id/gps', auth, (req: Authed, res) => {
  if (req.userRole !== 'technician') return res.status(403).json({ error: 'Technicians only' })
  const { active, lat, lng } = req.body as { active: boolean; lat?: number; lng?: number }
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!requireBookingAccess(req, res, booking, 'gps')) return
  const process = {
    ...emptyProcess(),
    ...(JSON.parse((booking.process as string) || '{}') as BookingProcess),
    gpsSharingActive: active,
    lastKnownLat: lat,
    lastKnownLng: lng,
  }
  db.prepare(`UPDATE bookings SET process = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify(process),
    new Date().toISOString(),
    req.params.id,
  )
  res.json({
    booking: mapBooking(
      db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

app.get('/api/partners', auth, (req: Authed, res) => {
  // Directory requires a session; customers/providers get public-safe fields only.
  const orgs = db
    .prepare(
      `SELECT * FROM provider_organizations WHERE status = 'active' ORDER BY founding_partner DESC, name`,
    )
    .all()
    .map((o) => mapOrganization(o as Record<string, unknown>))
  const role = req.userRole || ''
  const ownOrgId = role === 'provider' || role === 'technician' ? userOrgId(req.userId!) : undefined
  const partners =
    role === 'admin'
      ? orgs
      : orgs.map((o) => (ownOrgId && o.id === ownOrgId ? o : publicOrganization(o)))
  res.json({ partners, launchRegion: 'eastern-province' })
})

app.post('/api/discounts', auth, (req: Authed, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const code = req.body as {
    id?: string
    code: string
    percentOff: number
    maxUses: number
    active?: boolean
  }
  const id = code.id || uid('dc')
  const existing = db.prepare(`SELECT id FROM discount_codes WHERE id = ?`).get(id)
  if (existing) {
    db.prepare(
      `UPDATE discount_codes SET code = ?, percent_off = ?, max_uses = ?, active = ? WHERE id = ?`,
    ).run(code.code, code.percentOff, code.maxUses, code.active === false ? 0 : 1, id)
  } else {
    db.prepare(
      `INSERT INTO discount_codes (id, code, percent_off, active, max_uses, used_count) VALUES (?, ?, ?, 1, ?, 0)`,
    ).run(id, code.code, code.percentOff, code.maxUses)
  }
  res.json({
    discount: mapDiscount(
      db.prepare(`SELECT * FROM discount_codes WHERE id = ?`).get(id) as Record<string, unknown>,
    ),
  })
})

app.post('/api/discounts/:id/toggle', auth, (req: Authed, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' })
  db.prepare(`UPDATE discount_codes SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?`).run(
    req.params.id,
  )
  res.json({
    discount: mapDiscount(
      db.prepare(`SELECT * FROM discount_codes WHERE id = ?`).get(req.params.id) as Record<
        string,
        unknown
      >,
    ),
  })
})

app.post('/api/pricing', auth, (req: Authed, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const { categoryId, problemId, baseFeeSar } = req.body as {
    categoryId: string
    problemId: string
    baseFeeSar: number
  }
  db.prepare(
    `INSERT INTO pricing_overrides (category_id, problem_id, base_fee_sar) VALUES (?, ?, ?)
     ON CONFLICT(category_id, problem_id) DO UPDATE SET base_fee_sar = excluded.base_fee_sar`,
  ).run(categoryId, problemId, baseFeeSar)
  res.json({ override: { categoryId, problemId, baseFeeSar } })
})

app.post('/api/technicians/:id/toggle', auth, (req: Authed, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' })
  db.prepare(`UPDATE users SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?`).run(
    req.params.id,
  )
  res.json({
    user: mapUser(
      db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id) as Record<string, unknown>,
    ),
  })
})

/** Agent crew: propose sensitive actions (cancel, reassign, customer commitment). */
app.post('/api/agent/approvals', auth, (req: Authed, res) => {
  if (req.userRole !== 'admin' && req.userRole !== 'technician' && req.userRole !== 'provider') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const body = req.body as {
    action: 'cancel_booking' | 'reassign_technician' | 'customer_commitment'
    bookingId?: string
    payload?: Record<string, unknown>
    rationale: string
    proposedBy: string
  }
  if (!body.action || !body.rationale || !body.proposedBy) {
    return res.status(400).json({ error: 'action, rationale, proposedBy required' })
  }
  if (body.bookingId) {
    const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(body.bookingId) as
      | Record<string, unknown>
      | undefined
    if (!booking) return res.status(404).json({ error: 'Booking not found' })
    if (req.userRole !== 'admin') {
      const gate = assertBookingAccess(req, booking, 'field')
      if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
    }
  } else if (req.userRole !== 'admin') {
    return res.status(400).json({ error: 'bookingId required for non-admin proposals' })
  }
  const id = uid('apr')
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO agent_approvals (id, action, booking_id, payload, rationale, proposed_by, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(
    id,
    body.action,
    body.bookingId ?? null,
    JSON.stringify(body.payload || {}),
    body.rationale,
    req.userId!, // bind proposer to authenticated user — ignore spoofed proposedBy for auth
    now,
  )
  res.status(201).json({
    approval: {
      id,
      action: body.action,
      bookingId: body.bookingId ?? null,
      payload: body.payload || {},
      rationale: body.rationale,
      proposedBy: req.userId,
      status: 'pending',
      createdAt: now,
    },
  })
})

app.get('/api/agent/approvals', auth, (req: Authed, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const status = (req.query.status as string) || 'pending'
  const rows = db
    .prepare(
      `SELECT * FROM agent_approvals WHERE status = ? ORDER BY created_at DESC LIMIT 50`,
    )
    .all(status) as Record<string, unknown>[]
  res.json({
    approvals: rows.map((r) => ({
      id: r.id,
      action: r.action,
      bookingId: r.booking_id || null,
      payload: JSON.parse((r.payload as string) || '{}'),
      rationale: r.rationale,
      proposedBy: r.proposed_by,
      status: r.status,
      decidedBy: r.decided_by || null,
      decisionNote: r.decision_note || null,
      createdAt: r.created_at,
      decidedAt: r.decided_at || null,
    })),
  })
})

app.post('/api/agent/approvals/:id/decide', auth, (req: Authed, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const { approve, note } = req.body as { approve: boolean; note?: string }
  const row = db.prepare(`SELECT * FROM agent_approvals WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (row.status !== 'pending') return res.status(409).json({ error: 'Already decided' })

  const now = new Date().toISOString()
  const status = approve ? 'approved' : 'rejected'
  db.prepare(
    `UPDATE agent_approvals SET status = ?, decided_by = ?, decision_note = ?, decided_at = ? WHERE id = ?`,
  ).run(status, req.userId, note ?? null, now, req.params.id)

  let applied: unknown = null
  if (approve) {
    const action = row.action as string
    const bookingId = row.booking_id as string | null
    const payload = JSON.parse((row.payload as string) || '{}') as {
      technicianId?: string
      message?: string
    }
    if (action === 'cancel_booking' && bookingId) {
      const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(bookingId) as
        | Record<string, unknown>
        | undefined
      if (booking) {
        const history = JSON.parse((booking.status_history as string) || '[]') as object[]
        history.push({ status: 'cancelled', at: now, by: req.userId, note: note || 'Approved cancel' })
        db.prepare(
          `UPDATE bookings SET status = 'cancelled', status_history = ?, updated_at = ? WHERE id = ?`,
        ).run(JSON.stringify(history), now, bookingId)
        applied = { bookingId, status: 'cancelled' }
      }
    }
    if (action === 'reassign_technician' && bookingId && payload.technicianId) {
      const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(bookingId) as
        | Record<string, unknown>
        | undefined
      const tech = db
        .prepare(`SELECT * FROM users WHERE id = ? AND role = 'technician'`)
        .get(payload.technicianId) as Record<string, unknown> | undefined
      if (booking && tech) {
        const history = JSON.parse((booking.status_history as string) || '[]') as object[]
        history.push({
          status: 'technician_assigned',
          at: now,
          by: req.userId,
          note: `Reassigned (approved) to ${tech.name}`,
        })
        db.prepare(
          `UPDATE bookings SET technician_id = ?, organization_id = ?, assignment_mode = 'named_tech',
           status = 'technician_assigned', status_history = ?, updated_at = ? WHERE id = ?`,
        ).run(
          payload.technicianId,
          (tech.organization_id as string) || null,
          JSON.stringify(history),
          now,
          bookingId,
        )
        applied = { bookingId, technicianId: payload.technicianId, status: 'technician_assigned' }
      }
    }
    if (action === 'customer_commitment') {
      applied = {
        commitment: payload.message || note || 'Commitment recorded',
        bookingId,
      }
    }
  }

  res.json({
    approval: {
      id: row.id,
      status,
      decidedBy: req.userId,
      decisionNote: note ?? null,
      decidedAt: now,
      applied,
    },
  })
})

/** Invite / activate a technician under the provider org (enforces plan seat limit). */
app.post('/api/org/technicians', auth, (req: Authed, res) => {
  if (req.userRole !== 'provider' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Providers only' })
  }
  const orgId =
    req.userRole === 'admin'
      ? (req.body as { organizationId?: string }).organizationId
      : userOrgId(req.userId!)
  if (!orgId) return res.status(400).json({ error: 'organizationId required' })

  const seat = assertOrgSeatAvailable(orgId)
  if (!seat.ok) {
    return res.status(seat.status).json({
      error: seat.error,
      maxTechnicians: seat.max,
      usedSeats: seat.used,
      upgradeHint: 'Upgrade to Growth / Pro / Business for more technician seats.',
    })
  }

  const body = req.body as {
    name?: string
    nameAr?: string
    email?: string
    phone?: string
    password?: string
    cityId?: string
    districtId?: string
    specialties?: string[]
  }
  if (!body.name || !body.email || !body.phone || !body.password) {
    return res.status(400).json({ error: 'name, email, phone, password required' })
  }
  const exists = db.prepare(`SELECT id FROM users WHERE lower(email) = lower(?)`).get(body.email)
  if (exists) return res.status(409).json({ error: 'Email already registered' })

  const cityId = body.cityId || (seat.org!.city_id as string) || 'khobar'
  const phoneNorm = body.phone.startsWith('+') ? body.phone : `+966${body.phone.replace(/^0/, '')}`
  const now = new Date().toISOString()
  const techId = uid('tech')
  const techCode = nextTechnicianCode(cityId)
  const specialties = body.specialties?.length ? body.specialties : ['plumbing']

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO users (
        id, role, name, name_ar, email, phone, password_hash, city_id, district_id,
        specialties, rating, review_count, active, avatar_color, employment_type, organization_id,
        technician_code, last_active_at, created_at
      ) VALUES (?, 'technician', ?, ?, ?, ?, ?, ?, ?, ?, 5.0, 0, 1, '#156074', 'company', ?, ?, ?, ?)`,
    ).run(
      techId,
      body.name,
      body.nameAr || body.name,
      body.email,
      phoneNorm,
      bcrypt.hashSync(body.password!, 8),
      cityId,
      body.districtId ?? null,
      JSON.stringify(specialties),
      orgId,
      techCode,
      now,
      now,
    )
    db.prepare(
      `INSERT INTO organization_members (id, organization_id, user_id, member_role, active, created_at)
       VALUES (?, ?, ?, 'technician', 1, ?)`,
    ).run(uid('mem'), orgId, techId, now)
  })
  run()

  const user = mapUser(db.prepare(`SELECT * FROM users WHERE id = ?`).get(techId) as Record<string, unknown>)
  res.status(201).json({
    user,
    seats: {
      used: countActiveTechnicianSeats(orgId),
      max: seat.max,
    },
  })
})

/** Org digital company profile + survey fields (tenant-scoped). */
app.patch('/api/org/profile', auth, (req: Authed, res) => {
  if (req.userRole !== 'provider' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Providers only' })
  }
  const orgId =
    req.userRole === 'admin'
      ? (req.body as { organizationId?: string }).organizationId
      : userOrgId(req.userId!)
  if (!orgId) return res.status(400).json({ error: 'No organization' })

  const body = req.body as {
    name?: string
    nameAr?: string
    phone?: string
    email?: string
    whatsapp?: string
    commercialRegistration?: string
    licenseNumber?: string
    slaHours?: number
    techCountDeclared?: number
    serviceCityIds?: string[]
    specialties?: string[]
    priceApproverName?: string
    priceApproverPhone?: string
  }

  const org = db.prepare(`SELECT * FROM provider_organizations WHERE id = ?`).get(orgId) as
    | Record<string, unknown>
    | undefined
  if (!org) return res.status(404).json({ error: 'Not found' })

  db.prepare(
    `UPDATE provider_organizations SET
      name = COALESCE(?, name),
      name_ar = COALESCE(?, name_ar),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      whatsapp = COALESCE(?, whatsapp),
      commercial_registration = COALESCE(?, commercial_registration),
      license_number = COALESCE(?, license_number),
      sla_hours = COALESCE(?, sla_hours),
      tech_count_declared = COALESCE(?, tech_count_declared),
      service_city_ids = COALESCE(?, service_city_ids),
      specialties = COALESCE(?, specialties),
      price_approver_name = COALESCE(?, price_approver_name),
      price_approver_phone = COALESCE(?, price_approver_phone)
     WHERE id = ?`,
  ).run(
    body.name ?? null,
    body.nameAr ?? null,
    body.phone ?? null,
    body.email ?? null,
    body.whatsapp ?? null,
    body.commercialRegistration ?? null,
    body.licenseNumber ?? null,
    body.slaHours ?? null,
    body.techCountDeclared ?? null,
    body.serviceCityIds ? JSON.stringify(body.serviceCityIds) : null,
    body.specialties ? JSON.stringify(body.specialties) : null,
    body.priceApproverName ?? null,
    body.priceApproverPhone ?? null,
    orgId,
  )

  res.json({
    organization: mapOrganization(
      db.prepare(`SELECT * FROM provider_organizations WHERE id = ?`).get(orgId) as Record<
        string,
        unknown
      >,
    ),
  })
})

/** Seat usage for current org plan. */
app.get('/api/org/seats', auth, (req: Authed, res) => {
  if (req.userRole !== 'provider' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Providers only' })
  }
  const orgId =
    req.userRole === 'admin'
      ? (req.query.organizationId as string | undefined)
      : userOrgId(req.userId!)
  if (!orgId) return res.status(400).json({ error: 'No organization' })
  const org = db.prepare(`SELECT * FROM provider_organizations WHERE id = ?`).get(orgId) as
    | Record<string, unknown>
    | undefined
  if (!org) return res.status(404).json({ error: 'Not found' })
  const max = planMaxTechnicians(org.subscription_plan as string)
  const used = countActiveTechnicianSeats(orgId)
  const trialEnds = (org.trial_ends_at as string) || null
  const status = (org.subscription_status as string) || 'none'
  const paywall =
    status !== 'active' &&
    !isTrialActive(trialEnds) &&
    (status === 'trialing' || status === 'past_due' || Boolean(org.founding_partner))
  res.json({
    organizationId: orgId,
    plan: org.subscription_plan,
    subscriptionStatus: status,
    used,
    max,
    trialDays: org.trial_days ?? null,
    trialEndsAt: trialEnds,
    atLimit: max !== null && used >= max,
    paywall,
    paymentsProvider: paymentsMode(),
  })
})

function activateOrgSubscription(orgId: string, planId: PlanId, checkoutId?: string) {
  const now = new Date().toISOString()
  db.prepare(
    `UPDATE provider_organizations SET
      subscription_plan = ?,
      subscription_status = 'active',
      trial_ends_at = NULL
     WHERE id = ?`,
  ).run(planId, orgId)
  if (checkoutId) {
    db.prepare(
      `UPDATE subscription_checkouts SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending'`,
    ).run(now, checkoutId)
  }
  return mapOrganization(
    db.prepare(`SELECT * FROM provider_organizations WHERE id = ?`).get(orgId) as Record<
      string,
      unknown
    >,
  )
}

function findCheckoutByExternal(externalId: string) {
  return db
    .prepare(`SELECT * FROM subscription_checkouts WHERE external_id = ?`)
    .get(externalId) as Record<string, unknown> | undefined
}

/** Public plan catalog for checkout UI (no secrets). */
app.get('/api/subscription/plans', (_req, res) => {
  res.json({
    currency: 'SAR',
    methods: ['mada', 'visa', 'mastercard'],
    paymentsProvider: paymentsMode(),
    note:
      'Fees settle to the DARFIX platform merchant account. Partners do not upload CR into DARFIX for subscription payment.',
    plans: (Object.keys(PLAN_LIMITS) as PlanId[]).map((id) => ({
      id,
      ...PLAN_LIMITS[id],
      checkoutEnabled: isCheckoutPlan(id),
    })),
  })
})

/** Current org subscription + paywall hint. */
app.get('/api/org/subscription', auth, (req: Authed, res) => {
  if (req.userRole !== 'provider' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Providers only' })
  }
  const orgId =
    req.userRole === 'admin'
      ? (req.query.organizationId as string | undefined)
      : userOrgId(req.userId!)
  if (!orgId) return res.status(400).json({ error: 'No organization' })
  const org = db.prepare(`SELECT * FROM provider_organizations WHERE id = ?`).get(orgId) as
    | Record<string, unknown>
    | undefined
  if (!org) return res.status(404).json({ error: 'Not found' })
  const trialEnds = (org.trial_ends_at as string) || null
  const status = (org.subscription_status as string) || 'none'
  const paywall =
    status !== 'active' &&
    !isTrialActive(trialEnds) &&
    (status === 'trialing' || status === 'past_due' || Boolean(org.founding_partner))
  const pending = db
    .prepare(
      `SELECT * FROM subscription_checkouts
       WHERE organization_id = ? AND status = 'pending'
       ORDER BY created_at DESC LIMIT 5`,
    )
    .all(orgId) as Record<string, unknown>[]
  res.json({
    organization: mapOrganization(org),
    subscriptionStatus: status,
    plan: org.subscription_plan,
    trialEndsAt: trialEnds,
    trialActive: isTrialActive(trialEnds),
    paywall,
    paymentsProvider: paymentsMode(),
    methods: ['mada', 'visa', 'mastercard'],
    checkoutPlans: CHECKOUT_PLAN_PAYLOAD(),
    pendingCheckouts: pending.map(mapCheckoutRow),
  })
})

function CHECKOUT_PLAN_PAYLOAD() {
  return (['growth', 'pro', 'business'] as PlanId[]).map((id) => ({
    id,
    ...PLAN_LIMITS[id],
  }))
}

function mapCheckoutRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    planId: row.plan_id as string,
    amountSar: row.amount_sar as number,
    currency: (row.currency as string) || 'SAR',
    provider: row.provider as string,
    externalId: (row.external_id as string) || null,
    checkoutUrl: (row.checkout_url as string) || null,
    status: row.status as string,
    createdAt: row.created_at as string,
    paidAt: (row.paid_at as string) || null,
  }
}

/**
 * Start subscription checkout for Growth / Pro / Business.
 * Moyasar when MOYASAR_SECRET_KEY is set; otherwise mock (simulate endpoint).
 */
app.post('/api/org/subscription/checkout', auth, async (req: Authed, res) => {
  if (req.userRole !== 'provider' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Providers only' })
  }
  const orgId =
    req.userRole === 'admin' && req.body?.organizationId
      ? String(req.body.organizationId)
      : userOrgId(req.userId!)
  if (!orgId) return res.status(400).json({ error: 'No organization' })
  const planId = String(req.body?.planId || '')
  if (!isCheckoutPlan(planId)) {
    return res.status(400).json({
      error: 'Choose Growth, Pro, or Business. Launch is free; Enterprise is sales-assisted.',
    })
  }
  const amountSar = planPriceSar(planId)
  if (amountSar == null || amountSar <= 0) {
    return res.status(400).json({ error: 'Plan is not self-serve checkout' })
  }
  const org = db.prepare(`SELECT * FROM provider_organizations WHERE id = ?`).get(orgId) as
    | Record<string, unknown>
    | undefined
  if (!org) return res.status(404).json({ error: 'Organization not found' })

  const checkoutId = uid('chk')
  const host = req.get('host')
  const base = publicAppBaseUrl(host)
  const successUrl = `${base}/provider/billing?paid=1&checkout=${checkoutId}`
  const backUrl = `${base}/provider/billing`
  const callbackUrl = `${base}/api/payments/moyasar/callback?checkout=${checkoutId}`

  const provider = getPaymentProvider()
  try {
    const created = await provider.createSubscriptionCheckout({
      checkoutId,
      organizationId: orgId,
      organizationName: String(org.name),
      planId,
      planLabel: PLAN_LIMITS[planId].labelEn,
      amountSar,
      successUrl,
      backUrl,
      callbackUrl,
    })

    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO subscription_checkouts (
        id, organization_id, plan_id, amount_sar, currency, provider,
        external_id, checkout_url, status, created_by, created_at, metadata
      ) VALUES (?, ?, ?, ?, 'SAR', ?, ?, ?, 'pending', ?, ?, ?)`,
    ).run(
      checkoutId,
      orgId,
      planId,
      amountSar,
      created.provider,
      created.externalId,
      created.checkoutUrl,
      req.userId ?? null,
      now,
      JSON.stringify({ methods: ['mada', 'visa', 'mastercard'] }),
    )

    res.status(201).json({
      checkout: mapCheckoutRow(
        db.prepare(`SELECT * FROM subscription_checkouts WHERE id = ?`).get(checkoutId) as Record<
          string,
          unknown
        >,
      ),
      methods: ['mada', 'visa', 'mastercard'],
      paymentsProvider: created.provider,
      publishableKey:
        created.provider === 'moyasar' ? process.env.MOYASAR_PUBLISHABLE_KEY || null : null,
      simulateAvailable: created.provider === 'mock' && allowMockPayments(),
      note:
        created.provider === 'mock' && allowMockPayments()
          ? 'Mock mode — call POST /api/org/subscription/checkout/:id/simulate to mark paid.'
          : created.provider === 'mock'
            ? 'Mock provider is configured but simulate is disabled on this host.'
            : 'Hosted Moyasar page accepts Mada, Visa, Mastercard. Settlement → platform merchant IBAN.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed'
    return res.status(502).json({ error: message })
  }
})

/** Mock-only: mark checkout paid and activate plan (local/dev smoke). */
app.post('/api/org/subscription/checkout/:id/simulate', auth, (req: Authed, res) => {
  if (req.userRole !== 'provider' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Providers only' })
  }
  // Never allow simulate when a real PSP is configured, or on hosted/pilot without explicit flag.
  if (!allowMockPayments()) {
    return res.status(403).json({ error: 'Simulate disabled outside local mock payment mode' })
  }
  const row = db
    .prepare(`SELECT * FROM subscription_checkouts WHERE id = ?`)
    .get(req.params.id) as Record<string, unknown> | undefined
  if (!row) return res.status(404).json({ error: 'Checkout not found' })
  if (row.provider !== 'mock') {
    return res.status(400).json({ error: 'Simulate only available for mock checkouts' })
  }
  const orgId = userOrgId(req.userId!)
  if (req.userRole !== 'admin' && row.organization_id !== orgId) {
    return res.status(403).json({ error: 'Not your organization' })
  }
  if (row.status === 'paid') {
    return res.json({
      alreadyPaid: true,
      organization: mapOrganization(
        db
          .prepare(`SELECT * FROM provider_organizations WHERE id = ?`)
          .get(row.organization_id as string) as Record<string, unknown>,
      ),
      checkout: mapCheckoutRow(row),
    })
  }
  const organization = activateOrgSubscription(
    row.organization_id as string,
    row.plan_id as PlanId,
    row.id as string,
  )
  notify({
    userId: req.userId!,
    type: 'booking_confirmed',
    titleEn: 'Subscription active',
    titleAr: 'الاشتراك نشط',
    bodyEn: `Your ${PLAN_LIMITS[row.plan_id as PlanId]?.labelEn || row.plan_id} plan is now active.`,
    bodyAr: `باقة ${row.plan_id} أصبحتّلة الآن.`,
  })
  res.json({
    ok: true,
    organization,
    checkout: mapCheckoutRow(
      db.prepare(`SELECT * FROM subscription_checkouts WHERE id = ?`).get(row.id as string) as Record<
        string,
        unknown
      >,
    ),
  })
})

/**
 * Moyasar invoice callback / webhook.
 * Activates plan when invoice/payment is paid. Idempotent.
 */
app.post('/api/payments/moyasar/webhook', async (req, res) => {
  // Unauthenticated webhook must not activate plans while running in mock mode.
  if (paymentsMode() !== 'moyasar') {
    return res.status(403).json({ error: 'Webhook accepted only when Moyasar is configured' })
  }
  const payload = req.body || {}
  const data = (payload.data || payload) as Record<string, unknown>
  const meta = (data.metadata || {}) as Record<string, string>
  const externalId = String(data.id || payload.id || '')
  const status = String(data.status || payload.status || '')
  const checkoutId = meta.darfix_checkout_id || String(req.query.checkout || '')

  let row: Record<string, unknown> | undefined
  if (checkoutId) {
    row = db.prepare(`SELECT * FROM subscription_checkouts WHERE id = ?`).get(checkoutId) as
      | Record<string, unknown>
      | undefined
  }
  if (!row && externalId) row = findCheckoutByExternal(externalId)
  if (!row) {
    return res.status(404).json({ error: 'Checkout not found' })
  }

  const paid =
    status === 'paid' ||
    String(payload.type || '').includes('paid') ||
    String(data.status || '') === 'paid'

  if (!paid) {
    return res.json({ ok: true, ignored: true, status })
  }

  if (row.status === 'paid') {
    return res.json({ ok: true, alreadyPaid: true })
  }

  // Optional live verify when Moyasar keys present
  const provider = getPaymentProvider()
  if (provider.name === 'moyasar' && row.external_id && provider.fetchCheckoutStatus) {
    try {
      const remote = await provider.fetchCheckoutStatus(String(row.external_id))
      if (!remote.paid) {
        return res.json({ ok: true, ignored: true, remoteStatus: remote.status })
      }
    } catch {
      // Fall through to webhook claim if fetch fails (network); still require paid flag above.
    }
  }

  activateOrgSubscription(row.organization_id as string, row.plan_id as PlanId, row.id as string)
  res.json({ ok: true, activated: true, planId: row.plan_id })
})

/** Redirect/callback target after Moyasar hosted invoice (GET). */
app.get('/api/payments/moyasar/callback', async (req, res) => {
  const checkoutId = String(req.query.checkout || '')
  const invoiceId = String(req.query.id || req.query.invoice_id || '')
  let row: Record<string, unknown> | undefined
  if (checkoutId) {
    row = db.prepare(`SELECT * FROM subscription_checkouts WHERE id = ?`).get(checkoutId) as
      | Record<string, unknown>
      | undefined
  }
  if (!row && invoiceId) row = findCheckoutByExternal(invoiceId)

  const base = publicAppBaseUrl(req.get('host'))
  if (!row) {
    return res.redirect(`${base}/provider/billing?error=checkout_not_found`)
  }

  if (row.status !== 'paid') {
    const provider = getPaymentProvider()
    let paid = false
    if (provider.name === 'moyasar' && row.external_id && provider.fetchCheckoutStatus) {
      try {
        const remote = await provider.fetchCheckoutStatus(String(row.external_id))
        paid = remote.paid
      } catch {
        paid = false
      }
    }
    if (paid) {
      activateOrgSubscription(row.organization_id as string, row.plan_id as PlanId, row.id as string)
    }
  }

  return res.redirect(`${base}/provider/billing?checkout=${row.id}&paid=1`)
})

/** Seasonal campaign suggestions (human approval required — never auto-publish ads). */
app.get('/api/org/campaigns/suggestions', auth, (req: Authed, res) => {
  if (req.userRole !== 'provider' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Providers only' })
  }
  const year = new Date().getFullYear()
  const suggestions = [
    {
      id: 'ramadan',
      titleEn: 'Ramadan evening service window',
      titleAr: 'نافذة خدمة مسائية في رمضان',
      window: `${year}-02 — ${year}-03`,
      offerIdea: 'After-Taraweeh plumbing/electrical slots + 10% off diagnostics',
      channel: 'partner_co_marketing',
      requiresApproval: true,
    },
    {
      id: 'eid-fitr',
      titleEn: 'Eid al-Fitr home readiness',
      titleAr: 'تجهيز المنزل لعيد الفطر',
      window: `${year}-03`,
      offerIdea: 'Pre-Eid AC check + leak inspection bundle',
      channel: 'customer_promo',
      requiresApproval: true,
    },
    {
      id: 'eid-adha',
      titleEn: 'Eid al-Adha travel-safe homes',
      titleAr: 'منازل آمنة أثناء سفر العيد',
      window: `${year}-06`,
      offerIdea: 'Shutoff / inspection before travel',
      channel: 'customer_promo',
      requiresApproval: true,
    },
    {
      id: 'national-day',
      titleEn: 'Saudi National Day',
      titleAr: 'اليوم الوطني',
      window: `${year}-09-23`,
      offerIdea: 'Green-branded partner spotlight + limited lead boost',
      channel: 'partner_co_marketing',
      requiresApproval: true,
    },
    {
      id: 'founding-day',
      titleEn: 'Founding Day',
      titleAr: 'يوم التأسيس',
      window: `${year}-02-22`,
      offerIdea: 'Founding Partner badge campaign',
      channel: 'partner_co_marketing',
      requiresApproval: true,
    },
    {
      id: 'white-friday',
      titleEn: 'White Friday / Black Friday',
      titleAr: 'الجمعة البيضاء',
      window: `${year}-11`,
      offerIdea: 'Fixed-fee diagnostic promo (approval-gated pricing)',
      channel: 'customer_promo',
      requiresApproval: true,
    },
    {
      id: 'back-to-school',
      titleEn: 'Back to school',
      titleAr: 'العودة للمدارس',
      window: `${year}-08 — ${year}-09`,
      offerIdea: 'AC + lighting readiness packages',
      channel: 'customer_ads_draft',
      requiresApproval: true,
    },
    {
      id: 'summer-ac',
      titleEn: 'Summer AC peak',
      titleAr: 'ذروة تكييف الصيف',
      window: `${year}-05 — ${year}-09`,
      offerIdea: 'Priority AC dispatch slots for Pro+ partners',
      channel: 'ops_capacity',
      requiresApproval: true,
    },
  ]
  res.json({
    suggestions,
    note: 'Drafts only — never auto-publish paid ads without partner/DARFIX approval.',
  })
})

/** Demo SQLite backup (admin). Prefer scripts/backup-db.sh in ops. */
app.post('/api/admin/backup', auth, (req: Authed, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')
  const src = path.join(dataDir, 'darfix.sqlite')
  if (!fs.existsSync(src)) return res.status(404).json({ error: 'Database file not found' })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = path.join(dataDir, `darfix-backup-${stamp}.sqlite`)
  fs.copyFileSync(src, dest)
  for (const suffix of ['-wal', '-shm']) {
    const side = `${src}${suffix}`
    if (fs.existsSync(side)) fs.copyFileSync(side, `${dest}${suffix}`)
  }
  res.json({
    ok: true,
    path: dest,
    note: 'Demo SQLite snapshot. Production should use Postgres automated backups + PITR.',
  })
})

/** Production pilot: serve Vite `dist` from the same Node process as the API. */
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }))
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
  console.log(`Serving SPA from ${distDir}`)
} else {
  console.log(`No dist/ found at ${distDir} — API-only mode (run npm run build for combined pilot)`)
}

app.listen(PORT, () => {
  console.log(`DARFIX listening on http://127.0.0.1:${PORT}`)
})
