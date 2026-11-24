import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import crypto from 'node:crypto'
import { db, migrate, uid } from './db'
import {
  mapBooking,
  mapDiscount,
  mapInvoice,
  mapNotification,
  mapQuotation,
  mapUser,
} from './mappers'
import { DEMO_PASSWORD, seedIfEmpty } from './seed'
import { defaultChecklist, emptyProcess, type BookingProcess, type BookingStatus } from './types'

migrate()
seedIfEmpty()

const app = express()
const PORT = Number(process.env.PORT || 8787)
const JWT_FALLBACK_SECRET = process.env.DARFIX_SECRET || 'darfix-dev-secret'

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '8mb' }))

type Authed = express.Request & { userId?: string; userRole?: string }

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

function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString('hex')
  const created = new Date()
  const expires = new Date(created.getTime() + 7 * 86400000)
  db.prepare(`INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`).run(
    token,
    userId,
    created.toISOString(),
    expires.toISOString(),
  )
  return token
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

function loadBootstrap(userId: string, role: string, locale: 'en' | 'ar') {
  const users = db
    .prepare(`SELECT * FROM users`)
    .all()
    .map((u) => mapUser(u as Record<string, unknown>))

  let bookings = db.prepare(`SELECT * FROM bookings ORDER BY created_at DESC`).all().map((b) =>
    mapBooking(b as Record<string, unknown>),
  )
  if (role === 'customer') bookings = bookings.filter((b) => b.customerId === userId)
  if (role === 'technician') bookings = bookings.filter((b) => b.technicianId === userId)

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

  return {
    users: users.map((u) => ({ ...u, password: undefined })),
    bookings,
    notifications,
    quotations,
    invoices,
    discountCodes: role === 'admin' || role === 'customer' ? discountCodes : [],
    pricingOverrides,
    sessionUserId: userId,
    locale,
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'darfix', secretHint: JWT_FALLBACK_SECRET.slice(0, 4) })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  const row = db.prepare(`SELECT * FROM users WHERE lower(email) = lower(?)`).get(email) as
    | Record<string, unknown>
    | undefined
  if (!row || !bcrypt.compareSync(password, row.password_hash as string)) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  const token = createSession(row.id as string)
  res.json({ token, user: mapUser(row) })
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
    cityId ?? null,
    districtId ?? null,
    new Date().toISOString(),
  )
  const token = createSession(id)
  const user = mapUser(db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as Record<string, unknown>)
  res.status(201).json({ token, user })
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
  seedIfEmpty(true)
  const token = createSession('admin-1')
  res.json({ token, state: loadBootstrap('admin-1', 'admin', 'en'), demoPassword: DEMO_PASSWORD })
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
  const process: BookingProcess = {
    ...emptyProcess(),
    workChecklist: defaultChecklist(body.categoryId),
    currentStepNote: 'Request received — waiting for confirmation',
  }

  db.prepare(
    `INSERT INTO bookings (
      id, customer_id, category_id, problem_id, description, photos, address,
      preferred_date, preferred_time_slot, estimated_fee_sar, status, costs, extra_work,
      discount_code, discount_amount_sar, process, status_history, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new_request', ?, '[]', ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    req.userId,
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

  notify({
    userId: req.userId!,
    type: 'booking_confirmed',
    titleEn: 'Booking submitted',
    titleAr: 'تم إرسال الحجز',
    bodyEn: `Your ${body.categoryId} request ${id} was received.`,
    bodyAr: `تم استلام طلبك ${id}.`,
    bookingId: id,
  })
  for (const admin of db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all() as { id: string }[]) {
    notify({
      userId: admin.id,
      type: 'general',
      titleEn: 'New booking request',
      titleAr: 'طلب حجز جديد',
      bodyEn: `New ${body.categoryId} booking ${id}`,
      bodyAr: `حجز جديد ${id}`,
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
  if (!booking) return res.status(404).json({ error: 'Not found' })
  const { status, note } = req.body as { status: BookingStatus; note?: string }
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
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const { technicianId, allowReassign } = req.body as {
    technicianId: string
    allowReassign?: boolean
  }
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  const tech = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'technician'`).get(technicianId) as
    | Record<string, unknown>
    | undefined
  if (!booking || !tech) return res.status(404).json({ error: 'Not found' })
  if (
    booking.technician_id &&
    booking.technician_id !== technicianId &&
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
  history.push({ status: 'technician_assigned', at: now, by: req.userId })
  const process: BookingProcess = {
    ...emptyProcess(),
    ...JSON.parse((booking.process as string) || '{}'),
    workChecklist:
      JSON.parse((booking.process as string) || '{}').workChecklist?.length
        ? JSON.parse(booking.process as string).workChecklist
        : defaultChecklist(booking.category_id as string),
    currentStepNote: `Assigned to ${tech.name}`,
  }
  db.prepare(
    `UPDATE bookings SET technician_id = ?, status = 'technician_assigned', status_history = ?, process = ?, updated_at = ? WHERE id = ?`,
  ).run(technicianId, JSON.stringify(history), JSON.stringify(process), now, req.params.id)

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
    userId: technicianId,
    type: 'general',
    titleEn: 'New job assigned',
    titleAr: 'مهمة جديدة',
    bodyEn: `You were assigned booking ${req.params.id}.`,
    bodyAr: `تم تعيين الحجز ${req.params.id} لك.`,
    bookingId: req.params.id,
  })

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
  if (!booking) return res.status(404).json({ error: 'Not found' })
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
  if (!booking) return res.status(404).json({ error: 'Not found' })
  const costs = JSON.parse((booking.costs as string) || '[]') as unknown[]
  const incoming = (req.body as { costs: unknown[] }).costs || []
  db.prepare(`UPDATE bookings SET costs = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify([...costs, ...incoming]),
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
  if (!booking) return res.status(404).json({ error: 'Not found' })
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
  if (!booking) return res.status(404).json({ error: 'Not found' })
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
  if (!booking) return res.status(404).json({ error: 'Not found' })
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
  if (!booking || !booking.technician_id) return res.status(404).json({ error: 'Not found' })
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
  if (!booking) return res.status(404).json({ error: 'Not found' })
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
  if (!booking) return res.status(404).json({ error: 'Not found' })
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
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const { bookingId, lines } = req.body as {
    bookingId: string
    lines: { id: string; label: string; amountSar: number; type: string }[]
  }
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(bookingId) as
    | Record<string, unknown>
    | undefined
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const id = uid('q')
  const total = lines.reduce((s, l) => s + l.amountSar, 0)
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO quotations (id, booking_id, lines, total_sar, status, created_at) VALUES (?, ?, ?, ?, 'sent', ?)`,
  ).run(id, bookingId, JSON.stringify(lines), total, now)
  notify({
    userId: booking.customer_id as string,
    type: 'quotation',
    titleEn: 'New quotation',
    titleAr: 'عرض سعر جديد',
    bodyEn: `Quotation for ${bookingId}: SAR ${total}`,
    bodyAr: `عرض سعر للحجز ${bookingId}: ${total} ر.س`,
    bookingId,
  })
  res.status(201).json({
    quotation: mapQuotation(
      db.prepare(`SELECT * FROM quotations WHERE id = ?`).get(id) as Record<string, unknown>,
    ),
  })
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
  if (req.userRole !== 'admin' && req.userRole !== 'technician') {
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
    body.proposedBy,
    now,
  )
  res.status(201).json({
    approval: {
      id,
      action: body.action,
      bookingId: body.bookingId ?? null,
      payload: body.payload || {},
      rationale: body.rationale,
      proposedBy: body.proposedBy,
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
          `UPDATE bookings SET technician_id = ?, status = 'technician_assigned', status_history = ?, updated_at = ? WHERE id = ?`,
        ).run(payload.technicianId, JSON.stringify(history), now, bookingId)
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

app.listen(PORT, () => {
  console.log(`DARFIX API listening on http://127.0.0.1:${PORT}`)
})
