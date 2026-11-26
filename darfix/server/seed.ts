import bcrypt from 'bcryptjs'
import { db, SEED_VERSION, uid } from './db'
import { DEFAULT_TRIAL_DAYS, formatTechnicianCode, trialEndsAt } from './plans'
import { defaultChecklist, emptyProcess, type BookingProcess } from './types'

/** Local-only full demo dataset. Never enable on pilot/production publish. */
export function demoSeedEnabled() {
  if (process.env.DARFIX_SEED_DEMO !== '1') return false
  try {
    const forced = db.prepare(`SELECT value FROM meta WHERE key = 'security_force_seed_off'`).get() as
      | { value?: string }
      | undefined
    if (forced?.value === '1') return false
  } catch {
    /* table may not exist yet during first migrate */
  }
  return true
}

function resolveDemoPassword(): string | null {
  const fromEnv = process.env.DARFIX_DEMO_PASSWORD?.trim()
  return fromEnv || null
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600000).toISOString()
}
function daysAgo(d: number) {
  return new Date(Date.now() - d * 86400000).toISOString()
}
function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 3600000).toISOString()
}

function wipeAllData() {
  db.exec(`
    DELETE FROM sessions;
    DELETE FROM notifications;
    DELETE FROM quotations;
    DELETE FROM invoices;
    DELETE FROM discount_codes;
    DELETE FROM pricing_overrides;
    DELETE FROM agent_approvals;
    DELETE FROM security_findings;
    DELETE FROM lead_offers;
    DELETE FROM organization_members;
    DELETE FROM bookings;
    DELETE FROM users;
    DELETE FROM provider_organizations;
    DELETE FROM meta;
  `)
}

/** Pilot/production: empty DB or a single admin from env (no hardcoded passwords). */
function ensurePilotAdmin(): boolean {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM users`).get() as { c: number }
  if (row.c > 0) return false

  const email = process.env.DARFIX_ADMIN_EMAIL?.trim()
  const password = process.env.DARFIX_ADMIN_PASSWORD
  if (!email || !password) {
    console.warn(
      '[darfix] Empty users table — set DARFIX_ADMIN_EMAIL + DARFIX_ADMIN_PASSWORD to bootstrap admin, or DARFIX_SEED_DEMO=1 for local demo data',
    )
    return false
  }

  const now = new Date().toISOString()
  const hash = bcrypt.hashSync(password, 10)
  db.prepare(
    `INSERT INTO users (
      id, role, name, name_ar, email, phone, password_hash,
      city_id, district_id, specialties, rating, review_count, active, avatar_color,
      employment_type, organization_id, technician_code, last_active_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 0, 1, ?, NULL, NULL, NULL, ?, ?)`,
  ).run(
    'admin-1',
    'admin',
    'DARFIX Admin',
    'مسؤول دارفكس',
    email.toLowerCase(),
    '',
    hash,
    '#0f766e',
    now,
    now,
  )
  db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded', ?)`).run(now)
  db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('seed_version', ?)`).run(
    `pilot-admin-${SEED_VERSION}`,
  )
  console.info(`[darfix] Bootstrapped admin from DARFIX_ADMIN_EMAIL (${email})`)
  return true
}

function seedDemoDataset(force: boolean): boolean {
  const seeded = db.prepare(`SELECT value FROM meta WHERE key = 'seeded'`).get() as
    | { value: string }
    | undefined
  const version = db.prepare(`SELECT value FROM meta WHERE key = 'seed_version'`).get() as
    | { value: string }
    | undefined
  if (seeded && version?.value === SEED_VERSION && !force) return false

  const demoPassword = resolveDemoPassword()
  if (!demoPassword) {
    console.error(
      '[darfix] DARFIX_SEED_DEMO=1 requires DARFIX_DEMO_PASSWORD (set in local env only; never hardcode)',
    )
    return false
  }

  wipeAllData()

  const hash = bcrypt.hashSync(demoPassword, 8)
  const insertUser = db.prepare(`
    INSERT INTO users (
      id, role, name, name_ar, email, phone, password_hash,
      city_id, district_id, specialties, rating, review_count, active, avatar_color,
      employment_type, organization_id, technician_code, last_active_at, created_at
    ) VALUES (
      @id, @role, @name, @name_ar, @email, @phone, @password_hash,
      @city_id, @district_id, @specialties, @rating, @review_count, @active, @avatar_color,
      @employment_type, @organization_id, @technician_code, @last_active_at, @created_at
    )
  `)

  const insertOrg = db.prepare(`
    INSERT INTO provider_organizations (
      id, kind, name, name_ar, city_id, phone, email,
      commercial_registration, license_number, status,
      subscription_plan, subscription_status, founding_partner, service_city_ids,
      trial_days, trial_ends_at, whatsapp, sla_hours, tech_count_declared,
      specialties, price_approver_name, price_approver_phone, onboarding_survey, created_at
    ) VALUES (
      @id, @kind, @name, @name_ar, @city_id, @phone, @email,
      @commercial_registration, @license_number, @status,
      @subscription_plan, @subscription_status, @founding_partner, @service_city_ids,
      @trial_days, @trial_ends_at, @whatsapp, @sla_hours, @tech_count_declared,
      @specialties, @price_approver_name, @price_approver_phone, @onboarding_survey, @created_at
    )
  `)

  const insertMember = db.prepare(`
    INSERT INTO organization_members (
      id, organization_id, user_id, member_role, active, created_at
    ) VALUES (?, ?, ?, ?, 1, ?)
  `)

  const insertLead = db.prepare(`
    INSERT INTO lead_offers (
      id, booking_id, organization_id, status, offer_round, offered_at, deadline_at, responded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const now = new Date().toISOString()
  const foundingTrialEnd = trialEndsAt(new Date(), DEFAULT_TRIAL_DAYS)

  const orgs = [
    {
      id: 'org-company-1',
      kind: 'company',
      name: 'Eastern Home Care Co.',
      name_ar: 'شركة الشرقية للعناية المنزلية',
      city_id: 'khobar',
      phone: '+966138600100',
      email: 'ops@easternhomecare.sa',
      commercial_registration: '2052001234',
      license_number: 'EP-MNT-2024-88',
      status: 'active',
      subscription_plan: 'pro',
      subscription_status: 'trialing',
      founding_partner: 1,
      service_city_ids: JSON.stringify(['khobar', 'dhahran', 'dammam', 'jubail']),
      trial_days: DEFAULT_TRIAL_DAYS,
      trial_ends_at: foundingTrialEnd,
      whatsapp: '+966138600100',
      sla_hours: 4,
      tech_count_declared: 8,
      specialties: JSON.stringify(['plumbing', 'electrical']),
      price_approver_name: 'Hassan Al Mutairi',
      price_approver_phone: '+966501001001',
      onboarding_survey: JSON.stringify({
        services: ['plumbing', 'electrical'],
        cities: ['khobar', 'dhahran', 'dammam', 'jubail'],
        techCount: 8,
        slaHours: 4,
        completedAt: now,
      }),
    },
    {
      id: 'org-company-2',
      kind: 'company',
      name: 'Dammam Fix Pros',
      name_ar: 'مثبتو الدمام المحترفون',
      city_id: 'dammam',
      phone: '+966138601200',
      email: 'hello@dammamfix.sa',
      commercial_registration: '2053005678',
      license_number: 'DMM-MNT-2025-12',
      status: 'active',
      subscription_plan: 'growth',
      subscription_status: 'trialing',
      founding_partner: 1,
      service_city_ids: JSON.stringify(['dammam', 'khobar', 'dhahran']),
      trial_days: DEFAULT_TRIAL_DAYS,
      trial_ends_at: foundingTrialEnd,
      whatsapp: '+966138601200',
      sla_hours: 6,
      tech_count_declared: 3,
      specialties: JSON.stringify(['plumbing', 'electrical']),
      price_approver_name: 'Latifa Al Rashid',
      price_approver_phone: '+966502002002',
      onboarding_survey: JSON.stringify({
        services: ['plumbing', 'electrical'],
        cities: ['dammam', 'khobar', 'dhahran'],
        techCount: 3,
        slaHours: 6,
        completedAt: now,
      }),
    },
    {
      id: 'org-company-3',
      kind: 'company',
      name: 'Jubail Maintenance Partners',
      name_ar: 'شركاء الجبيل للصيانة',
      city_id: 'jubail',
      phone: '+966133600100',
      email: 'ops@jubailpartners.sa',
      commercial_registration: '2055001234',
      license_number: 'JBL-MNT-2024-88',
      status: 'active',
      subscription_plan: 'pro',
      subscription_status: 'trialing',
      founding_partner: 1,
      service_city_ids: JSON.stringify(['jubail', 'dammam']),
      trial_days: DEFAULT_TRIAL_DAYS,
      trial_ends_at: foundingTrialEnd,
      whatsapp: '+966133600100',
      sla_hours: 4,
      tech_count_declared: 5,
      specialties: JSON.stringify(['plumbing', 'electrical']),
      price_approver_name: null,
      price_approver_phone: null,
      onboarding_survey: null,
    },
    {
      id: 'org-indie-1',
      kind: 'independent',
      name: 'Mohammed Al Otaibi (Independent)',
      name_ar: 'محمد العتيبي (مستقل)',
      city_id: 'khobar',
      phone: '+966501112233',
      email: 'tech@darfix.sa',
      commercial_registration: null,
      license_number: 'FREELANCE-EP-01',
      status: 'active',
      subscription_plan: 'launch',
      subscription_status: 'none',
      founding_partner: 0,
      service_city_ids: JSON.stringify(['khobar', 'dhahran']),
      trial_days: null,
      trial_ends_at: null,
      whatsapp: '+966501112233',
      sla_hours: 8,
      tech_count_declared: 1,
      specialties: JSON.stringify(['plumbing', 'electrical']),
      price_approver_name: null,
      price_approver_phone: null,
      onboarding_survey: null,
    },
    {
      id: 'org-indie-2',
      kind: 'independent',
      name: 'Nasser Al Dosari (Independent)',
      name_ar: 'ناصر الدوسري (مستقل)',
      city_id: 'dammam',
      phone: '+966507778899',
      email: 'nasser@darfix.sa',
      commercial_registration: null,
      license_number: 'FREELANCE-EP-02',
      status: 'active',
      subscription_plan: 'launch',
      subscription_status: 'none',
      founding_partner: 0,
      service_city_ids: JSON.stringify(['dammam', 'khobar']),
      trial_days: null,
      trial_ends_at: null,
      whatsapp: '+966507778899',
      sla_hours: 8,
      tech_count_declared: 1,
      specialties: JSON.stringify(['electrical']),
      price_approver_name: null,
      price_approver_phone: null,
      onboarding_survey: null,
    },
  ]

  const users = [
    {
      id: 'cust-1',
      role: 'customer',
      name: 'Sara Al Harbi',
      name_ar: 'سارة الحربي',
      email: 'customer@darfix.sa',
      phone: '+966512345678',
      city_id: 'khobar',
      district_id: 'thuqbah',
      specialties: null,
      rating: null,
      review_count: 0,
      active: 1,
      avatar_color: '#14B8A6',
      employment_type: null,
      organization_id: null,
      technician_code: null,
      last_active_at: null,
    },
    {
      id: 'cust-2',
      role: 'customer',
      name: 'Fahad Al Qahtani',
      name_ar: 'فهد القحطاني',
      email: 'fahad@example.sa',
      phone: '+966598765432',
      city_id: 'dammam',
      district_id: 'faisaliyah',
      specialties: null,
      rating: null,
      review_count: 0,
      active: 1,
      avatar_color: '#0D9488',
      employment_type: null,
      organization_id: null,
      technician_code: null,
      last_active_at: null,
    },
    {
      id: 'provider-1',
      role: 'provider',
      name: 'Hassan Al Mutairi',
      name_ar: 'حسن المطيري',
      email: 'company@darfix.sa',
      phone: '+966501001001',
      city_id: 'khobar',
      district_id: 'corniche',
      specialties: null,
      rating: null,
      review_count: 0,
      active: 1,
      avatar_color: '#0F766E',
      employment_type: 'company',
      organization_id: 'org-company-1',
      technician_code: null,
      last_active_at: hoursAgo(1),
    },
    {
      id: 'provider-2',
      role: 'provider',
      name: 'Latifa Al Rashid',
      name_ar: 'لطيفة الراشد',
      email: 'dammam@darfix.sa',
      phone: '+966502002002',
      city_id: 'dammam',
      district_id: 'faisaliyah',
      specialties: null,
      rating: null,
      review_count: 0,
      active: 1,
      avatar_color: '#0E7490',
      employment_type: 'company',
      organization_id: 'org-company-2',
      technician_code: null,
      last_active_at: hoursAgo(3),
    },
    {
      id: 'tech-1',
      role: 'technician',
      name: 'Mohammed Al Otaibi',
      name_ar: 'محمد العتيبي',
      email: 'tech@darfix.sa',
      phone: '+966501112233',
      city_id: 'khobar',
      district_id: 'thuqbah',
      specialties: JSON.stringify(['plumbing', 'electrical']),
      rating: 4.8,
      review_count: 126,
      active: 1,
      avatar_color: '#0B3A4A',
      employment_type: 'independent',
      organization_id: 'org-indie-1',
      technician_code: formatTechnicianCode('khobar', 1),
      last_active_at: hoursAgo(2),
    },
    {
      id: 'tech-2',
      role: 'technician',
      name: 'Khalid Al Ghamdi',
      name_ar: 'خالد الغامدي',
      email: 'khalid@darfix.sa',
      phone: '+966504445566',
      city_id: 'khobar',
      district_id: 'olaya-k',
      specialties: JSON.stringify(['plumbing']),
      rating: 4.6,
      review_count: 89,
      active: 1,
      avatar_color: '#156074',
      employment_type: 'company',
      organization_id: 'org-company-1',
      technician_code: formatTechnicianCode('khobar', 42),
      last_active_at: hoursAgo(8),
    },
    {
      id: 'tech-3',
      role: 'technician',
      name: 'Nasser Al Dosari',
      name_ar: 'ناصر الدوسري',
      email: 'nasser@darfix.sa',
      phone: '+966507778899',
      city_id: 'dammam',
      district_id: 'shati-d',
      specialties: JSON.stringify(['electrical']),
      rating: 4.9,
      review_count: 64,
      active: 1,
      avatar_color: '#0F4A5C',
      employment_type: 'independent',
      organization_id: 'org-indie-2',
      technician_code: formatTechnicianCode('dammam', 7),
      last_active_at: daysAgo(1),
    },
    {
      id: 'tech-4',
      role: 'technician',
      name: 'Yousef Al Shammari',
      name_ar: 'يوسف الشمري',
      email: 'yousef@easternhomecare.sa',
      phone: '+966509998877',
      city_id: 'dhahran',
      district_id: 'doha-d',
      specialties: JSON.stringify(['plumbing', 'electrical']),
      rating: 4.7,
      review_count: 41,
      active: 1,
      avatar_color: '#115E59',
      employment_type: 'company',
      organization_id: 'org-company-1',
      technician_code: formatTechnicianCode('dhahran', 18),
      last_active_at: hoursAgo(5),
    },
    {
      id: 'tech-5',
      role: 'technician',
      name: 'Sami Al Qahtani',
      name_ar: 'سامي القحطاني',
      email: 'sami@dammamfix.sa',
      phone: '+966503334455',
      city_id: 'dammam',
      district_id: 'jalawiyah',
      specialties: JSON.stringify(['plumbing', 'electrical']),
      rating: 4.5,
      review_count: 28,
      active: 1,
      avatar_color: '#134E4A',
      employment_type: 'company',
      organization_id: 'org-company-2',
      technician_code: formatTechnicianCode('dammam', 11),
      last_active_at: hoursAgo(12),
    },
    {
      id: 'admin-1',
      role: 'admin',
      name: 'DARFIX Admin',
      name_ar: 'مسؤول دارفكس',
      email: 'admin@darfix.sa',
      phone: '+966500000001',
      city_id: 'khobar',
      district_id: null,
      specialties: null,
      rating: null,
      review_count: 0,
      active: 1,
      avatar_color: '#061820',
      employment_type: null,
      organization_id: null,
      technician_code: null,
      last_active_at: null,
    },
  ]

  const tx = db.transaction(() => {
    for (const o of orgs) {
      insertOrg.run({ ...o, created_at: now })
    }
    for (const u of users) {
      insertUser.run({ ...u, password_hash: hash, created_at: now })
    }

    insertMember.run('mem-1', 'org-company-1', 'provider-1', 'owner', now)
    insertMember.run('mem-2', 'org-company-1', 'tech-2', 'technician', now)
    insertMember.run('mem-3', 'org-company-1', 'tech-4', 'technician', now)
    insertMember.run('mem-4', 'org-company-2', 'provider-2', 'owner', now)
    insertMember.run('mem-5', 'org-company-2', 'tech-5', 'technician', now)
    insertMember.run('mem-6', 'org-indie-1', 'tech-1', 'owner', now)
    insertMember.run('mem-7', 'org-indie-2', 'tech-3', 'owner', now)
    insertMember.run('mem-8', 'org-company-3', 'provider-1', 'dispatcher', now)

    const processOnWay: BookingProcess = {
      ...emptyProcess(),
      estimatedArrival: new Date(Date.now() + 25 * 60000).toISOString(),
      currentStepNote: 'Technician departed Thuqbah — ETA ~25 minutes',
      gpsSharingActive: true,
      lastKnownLat: 26.22,
      lastKnownLng: 50.2,
      workChecklist: defaultChecklist('plumbing'),
      technicianNotes: [
        {
          id: 'pn-1',
          at: hoursAgo(2),
          text: 'Accepted job. Heading from Thuqbah with spare fittings. GPS sharing on.',
          authorId: 'tech-1',
        },
      ],
    }

    const processAwaiting: BookingProcess = {
      ...emptyProcess(),
      arrivedAt: daysAgo(3),
      startedAt: daysAgo(3),
      currentStepNote: 'Quote pending company price approval',
      gpsSharingActive: true,
      workChecklist: defaultChecklist('plumbing').map((c, i) => ({
        ...c,
        done: i < 2,
      })),
      technicianNotes: [
        {
          id: 'pn-2',
          at: hoursAgo(8),
          text: 'Diagnosed failed heating element. Submitted quote for company approval.',
          authorId: 'tech-2',
        },
      ],
    }

    const processDone: BookingProcess = {
      ...emptyProcess(),
      arrivedAt: daysAgo(12),
      startedAt: daysAgo(12),
      completedAt: daysAgo(12),
      currentStepNote: 'Job completed and invoiced',
      gpsSharingActive: false,
      workChecklist: defaultChecklist('electrical').map((c) => ({ ...c, done: true })),
      technicianNotes: [
        {
          id: 'pn-3',
          at: daysAgo(12),
          text: 'Replaced two sockets; breaker connection tightened and load-tested.',
          authorId: 'tech-1',
        },
      ],
    }

    const insertBooking = db.prepare(`
      INSERT INTO bookings (
        id, customer_id, technician_id, organization_id, assignment_mode, tech_response,
        preferred_organization_id,
        category_id, problem_id, description, photos,
        address, preferred_date, preferred_time_slot, estimated_fee_sar, status, costs,
        extra_work, job_report, rating, review_text, reviewed_at, discount_code,
        discount_amount_sar, process, status_history, created_at, updated_at
      ) VALUES (
        @id, @customer_id, @technician_id, @organization_id, @assignment_mode, @tech_response,
        @preferred_organization_id,
        @category_id, @problem_id, @description, @photos,
        @address, @preferred_date, @preferred_time_slot, @estimated_fee_sar, @status, @costs,
        @extra_work, @job_report, @rating, @review_text, @reviewed_at, @discount_code,
        @discount_amount_sar, @process, @status_history, @created_at, @updated_at
      )
    `)

    insertBooking.run({
      id: 'bk-1001',
      customer_id: 'cust-1',
      technician_id: 'tech-1',
      organization_id: 'org-indie-1',
      assignment_mode: 'named_tech',
      tech_response: 'accepted',
      preferred_organization_id: 'org-indie-1',
      category_id: 'plumbing',
      problem_id: 'water-leaks',
      description: 'Kitchen sink pipe is leaking under the cabinet. Water pooling overnight.',
      photos: '[]',
      address: JSON.stringify({
        cityId: 'khobar',
        districtId: 'thuqbah',
        street: 'Prince Turki St, Building 12, Apt 5',
        lat: 26.221,
        lng: 50.197,
      }),
      preferred_date: daysAgo(-1).slice(0, 10),
      preferred_time_slot: '10-12',
      estimated_fee_sar: 120,
      status: 'on_the_way',
      costs: JSON.stringify([{ id: 'c1', label: 'Service call', amountSar: 120, type: 'fee' }]),
      extra_work: '[]',
      job_report: null,
      rating: null,
      review_text: null,
      reviewed_at: null,
      discount_code: null,
      discount_amount_sar: null,
      process: JSON.stringify(processOnWay),
      status_history: JSON.stringify([
        { status: 'new_request', at: daysAgo(1) },
        { status: 'confirmed', at: hoursAgo(20), by: 'admin-1' },
        { status: 'technician_assigned', at: hoursAgo(18), by: 'admin-1' },
        { status: 'on_the_way', at: hoursAgo(2), by: 'tech-1', note: 'Departed Thuqbah' },
      ]),
      created_at: daysAgo(1),
      updated_at: hoursAgo(2),
    })

    insertBooking.run({
      id: 'bk-1002',
      customer_id: 'cust-1',
      technician_id: 'tech-1',
      organization_id: 'org-indie-1',
      assignment_mode: 'named_tech',
      tech_response: 'accepted',
      preferred_organization_id: null,
      category_id: 'electrical',
      problem_id: 'switch-socket',
      description: 'Living room sockets not working. Breaker trips when used.',
      photos: '[]',
      address: JSON.stringify({
        cityId: 'khobar',
        districtId: 'thuqbah',
        street: 'Prince Turki St, Building 12, Apt 5',
        lat: 26.221,
        lng: 50.197,
      }),
      preferred_date: daysAgo(12).slice(0, 10),
      preferred_time_slot: '14-16',
      estimated_fee_sar: 110,
      status: 'completed',
      costs: JSON.stringify([
        { id: 'c2', label: 'Service call', amountSar: 110, type: 'fee' },
        { id: 'c3', label: 'Socket replacement (x2)', amountSar: 80, type: 'materials' },
        { id: 'c4', label: 'Labor', amountSar: 60, type: 'labor' },
      ]),
      extra_work: '[]',
      job_report:
        'Replaced two wall sockets and tightened breaker connection. Tested under load — OK.',
      rating: 5,
      review_text: 'Mohammed was punctual and fixed everything quickly. Highly recommend!',
      reviewed_at: daysAgo(11),
      discount_code: null,
      discount_amount_sar: null,
      process: JSON.stringify(processDone),
      status_history: JSON.stringify([
        { status: 'new_request', at: daysAgo(14) },
        { status: 'confirmed', at: daysAgo(14) },
        { status: 'technician_assigned', at: daysAgo(13) },
        { status: 'completed', at: daysAgo(12) },
      ]),
      created_at: daysAgo(14),
      updated_at: daysAgo(11),
    })

    insertBooking.run({
      id: 'bk-1003',
      customer_id: 'cust-2',
      technician_id: null,
      organization_id: 'org-company-1',
      assignment_mode: 'company_pool',
      tech_response: null,
      preferred_organization_id: 'org-company-1',
      category_id: 'plumbing',
      problem_id: 'blocked-drains',
      description: 'Bathroom drain completely blocked. Slow for days then stopped.',
      photos: '[]',
      address: JSON.stringify({
        cityId: 'dammam',
        districtId: 'faisaliyah',
        street: 'King Saud Rd, Villa 8',
        lat: 26.428,
        lng: 50.101,
      }),
      preferred_date: daysAgo(-2).slice(0, 10),
      preferred_time_slot: '16-18',
      estimated_fee_sar: 150,
      status: 'confirmed',
      costs: JSON.stringify([{ id: 'c5', label: 'Service call', amountSar: 150, type: 'fee' }]),
      extra_work: '[]',
      job_report: null,
      rating: null,
      review_text: null,
      reviewed_at: null,
      discount_code: null,
      discount_amount_sar: null,
      process: JSON.stringify({
        ...emptyProcess(),
        workChecklist: defaultChecklist('plumbing'),
        currentStepNote: 'Lead accepted by Eastern Home Care — awaiting named technician',
      }),
      status_history: JSON.stringify([
        { status: 'new_request', at: hoursAgo(5) },
        { status: 'confirmed', at: hoursAgo(4), by: 'provider-1' },
      ]),
      created_at: hoursAgo(5),
      updated_at: hoursAgo(4),
    })

    insertBooking.run({
      id: 'bk-1004',
      customer_id: 'cust-2',
      technician_id: 'tech-2',
      organization_id: 'org-company-1',
      assignment_mode: 'named_tech',
      tech_response: 'accepted',
      preferred_organization_id: 'org-company-1',
      category_id: 'plumbing',
      problem_id: 'water-heater',
      description: 'Water heater not heating. Unit is 4 years old.',
      photos: '[]',
      address: JSON.stringify({
        cityId: 'dammam',
        districtId: 'faisaliyah',
        street: 'King Saud Rd, Villa 8',
        lat: 26.428,
        lng: 50.101,
      }),
      preferred_date: daysAgo(3).slice(0, 10),
      preferred_time_slot: '10-12',
      estimated_fee_sar: 180,
      status: 'awaiting_approval',
      costs: JSON.stringify([
        { id: 'c6', label: 'Service call', amountSar: 180, type: 'fee' },
        { id: 'c7', label: 'Heating element', amountSar: 220, type: 'materials' },
      ]),
      extra_work: JSON.stringify([
        {
          id: 'ew-1',
          description: 'Heating element needs replacement — not covered by diagnostic fee',
          amountSar: 220,
          status: 'pending',
          createdAt: hoursAgo(8),
        },
      ]),
      job_report: null,
      rating: null,
      review_text: null,
      reviewed_at: null,
      discount_code: null,
      discount_amount_sar: null,
      process: JSON.stringify(processAwaiting),
      status_history: JSON.stringify([
        { status: 'new_request', at: daysAgo(4) },
        { status: 'confirmed', at: daysAgo(4) },
        { status: 'technician_assigned', at: daysAgo(3) },
        { status: 'in_progress', at: daysAgo(3) },
        { status: 'awaiting_approval', at: hoursAgo(8), by: 'tech-2' },
      ]),
      created_at: daysAgo(4),
      updated_at: hoursAgo(8),
    })

    insertBooking.run({
      id: 'bk-1005',
      customer_id: 'cust-1',
      technician_id: null,
      organization_id: null,
      assignment_mode: null,
      tech_response: null,
      preferred_organization_id: null,
      category_id: 'electrical',
      problem_id: 'power-outages',
      description: 'Partial power outage in master bedroom circuit since this morning.',
      photos: '[]',
      address: JSON.stringify({
        cityId: 'khobar',
        districtId: 'corniche',
        street: 'Corniche Rd, Tower 3, Floor 9',
        lat: 26.235,
        lng: 50.21,
      }),
      preferred_date: daysAgo(-1).slice(0, 10),
      preferred_time_slot: '12-14',
      estimated_fee_sar: 150,
      status: 'new_request',
      costs: JSON.stringify([{ id: 'c8', label: 'Service call', amountSar: 150, type: 'fee' }]),
      extra_work: '[]',
      job_report: null,
      rating: null,
      review_text: null,
      reviewed_at: null,
      discount_code: null,
      discount_amount_sar: null,
      process: JSON.stringify({
        ...emptyProcess(),
        workChecklist: defaultChecklist('electrical'),
        currentStepNote: 'Limited lead offers sent to 2 partner companies — awaiting response',
      }),
      status_history: JSON.stringify([{ status: 'new_request', at: hoursAgo(1) }]),
      created_at: hoursAgo(1),
      updated_at: hoursAgo(1),
    })

    // Limited competition: 2 offers (not blast) with deadlines
    insertLead.run(
      'lo-1',
      'bk-1005',
      'org-company-1',
      'offered',
      1,
      hoursAgo(1),
      hoursFromNow(2),
      null,
    )
    insertLead.run(
      'lo-2',
      'bk-1005',
      'org-company-2',
      'offered',
      1,
      hoursAgo(1),
      hoursFromNow(2),
      null,
    )
    insertLead.run(
      'lo-3',
      'bk-1003',
      'org-company-1',
      'accepted',
      1,
      hoursAgo(5),
      hoursAgo(3),
      hoursAgo(4),
    )
    insertLead.run(
      'lo-4',
      'bk-1003',
      'org-company-2',
      'expired',
      1,
      hoursAgo(5),
      hoursAgo(3),
      null,
    )

    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title_en, title_ar, body_en, body_ar, booking_id, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'n1',
      'cust-1',
      'on_the_way',
      'Technician on the way',
      'الفني في الطريق',
      'Mohammed is heading to your Khobar location for booking #bk-1001.',
      'محمد في الطريق إلى موقعك في الخبر للحجز #bk-1001.',
      'bk-1001',
      0,
      hoursAgo(2),
    )
    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title_en, title_ar, body_en, body_ar, booking_id, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'n2',
      'cust-1',
      'job_completed',
      'Job completed',
      'اكتملت المهمة',
      'Your electrical booking #bk-1002 is complete. Please leave a review.',
      'اكتمل حجز الكهرباء #bk-1002. يرجى ترك تقييم.',
      'bk-1002',
      1,
      daysAgo(12),
    )
    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title_en, title_ar, body_en, body_ar, booking_id, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'n3',
      'cust-2',
      'extra_work',
      'Extra work approval needed',
      'مطلوب الموافقة على عمل إضافي',
      'Your technician requested approval for additional materials (SAR 220).',
      'طلب الفني موافقتك على مواد إضافية (٢٢٠ ر.س).',
      'bk-1004',
      0,
      hoursAgo(8),
    )
    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title_en, title_ar, body_en, body_ar, booking_id, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'n4',
      'provider-1',
      'lead_offer',
      'New lead offer — respond soon',
      'عرض عميل جديد — سارع بالرد',
      'Exclusive/limited lead #bk-1005 for electrical power outage. Deadline in ~2h.',
      'عرض محدود #bk-1005 لانقطاع كهرباء. الموعد النهائي خلال ساعتين تقريباً.',
      'bk-1005',
      0,
      hoursAgo(1),
    )
    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title_en, title_ar, body_en, body_ar, booking_id, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'n5',
      'provider-1',
      'quotation',
      'Quote needs price approval',
      'عرض سعر بانتظار موافقة التسعير',
      'Technician Khalid submitted a quote on #bk-1004 — approve, reject, or clarify.',
      'قدّم الفني خالد عرض سعر على #bk-1004 — وافق أو ارفض أو اطلب توضيحاً.',
      'bk-1004',
      0,
      hoursAgo(8),
    )
    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title_en, title_ar, body_en, body_ar, booking_id, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'n6',
      'provider-2',
      'lead_offer',
      'New lead offer — respond soon',
      'عرض عميل جديد — سارع بالرد',
      'Limited lead #bk-1005 for electrical power outage. Competing with 1 other partner.',
      'عرض محدود #bk-1005 لانقطاع كهرباء. منافسة مع شريك واحد.',
      'bk-1005',
      0,
      hoursAgo(1),
    )

    db.prepare(
      `INSERT INTO quotations (id, booking_id, lines, total_sar, status, created_at, submitted_by, company_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'q-1',
      'bk-1004',
      JSON.stringify([
        { id: 'ql1', label: 'Diagnostic fee', amountSar: 180, type: 'fee' },
        { id: 'ql2', label: 'Heating element', amountSar: 220, type: 'materials' },
      ]),
      400,
      'pending_company_approval',
      hoursAgo(8),
      'tech-2',
      null,
    )

    db.prepare(
      `INSERT INTO invoices (id, booking_id, customer_id, lines, total_sar, status, created_at, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'inv-1',
      'bk-1002',
      'cust-1',
      JSON.stringify([
        { id: 'il1', label: 'Service call', amountSar: 110, type: 'fee' },
        { id: 'il2', label: 'Socket replacement (x2)', amountSar: 80, type: 'materials' },
        { id: 'il3', label: 'Labor', amountSar: 60, type: 'labor' },
      ]),
      250,
      'paid',
      daysAgo(12),
      daysAgo(12),
    )

    db.prepare(
      `INSERT INTO discount_codes (id, code, percent_off, active, max_uses, used_count) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('dc-1', 'EP20', 20, 1, 100, 12)
    db.prepare(
      `INSERT INTO discount_codes (id, code, percent_off, active, max_uses, used_count) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('dc-2', 'WELCOME15', 15, 1, 50, 8)

    db.prepare(`INSERT INTO meta (key, value) VALUES ('seeded', ?)`).run(now)
    db.prepare(`INSERT INTO meta (key, value) VALUES ('seed_version', ?)`).run(SEED_VERSION)
    db.prepare(`INSERT INTO meta (key, value) VALUES ('launch_region', ?)`).run('eastern-province')
  })

  tx()
  return true
}

/**
 * Boot / reset entrypoint.
 * - DARFIX_SEED_DEMO=1 → full local demo dataset (password from DARFIX_DEMO_PASSWORD only)
 * - otherwise → no demo users; optional single admin from DARFIX_ADMIN_EMAIL + DARFIX_ADMIN_PASSWORD
 */
export function seedIfEmpty(force = false) {
  if (demoSeedEnabled()) {
    return seedDemoDataset(force)
  }
  if (force) {
    // Hard wipe without re-seeding demos — pilot reset is disabled at the route layer.
    wipeAllData()
    return ensurePilotAdmin()
  }
  return ensurePilotAdmin()
}

export { uid }
