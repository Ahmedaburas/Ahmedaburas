import bcrypt from 'bcryptjs'
import { db, SEED_VERSION, uid } from './db'
import { defaultChecklist, emptyProcess, type BookingProcess } from './types'

const DEMO_PASSWORD = 'demo123'

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600000).toISOString()
}
function daysAgo(d: number) {
  return new Date(Date.now() - d * 86400000).toISOString()
}

export function seedIfEmpty(force = false) {
  const seeded = db.prepare(`SELECT value FROM meta WHERE key = 'seeded'`).get() as
    | { value: string }
    | undefined
  const version = db.prepare(`SELECT value FROM meta WHERE key = 'seed_version'`).get() as
    | { value: string }
    | undefined
  if (seeded && version?.value === SEED_VERSION && !force) return false

  db.exec(`
    DELETE FROM sessions;
    DELETE FROM notifications;
    DELETE FROM quotations;
    DELETE FROM invoices;
    DELETE FROM discount_codes;
    DELETE FROM pricing_overrides;
    DELETE FROM agent_approvals;
    DELETE FROM organization_members;
    DELETE FROM bookings;
    DELETE FROM users;
    DELETE FROM provider_organizations;
    DELETE FROM meta;
  `)

  const hash = bcrypt.hashSync(DEMO_PASSWORD, 8)
  const insertUser = db.prepare(`
    INSERT INTO users (
      id, role, name, name_ar, email, phone, password_hash,
      city_id, district_id, specialties, rating, review_count, active, avatar_color,
      employment_type, organization_id, created_at
    ) VALUES (
      @id, @role, @name, @name_ar, @email, @phone, @password_hash,
      @city_id, @district_id, @specialties, @rating, @review_count, @active, @avatar_color,
      @employment_type, @organization_id, @created_at
    )
  `)

  const insertOrg = db.prepare(`
    INSERT INTO provider_organizations (
      id, kind, name, name_ar, city_id, phone, email,
      commercial_registration, license_number, status, created_at
    ) VALUES (
      @id, @kind, @name, @name_ar, @city_id, @phone, @email,
      @commercial_registration, @license_number, @status, @created_at
    )
  `)

  const insertMember = db.prepare(`
    INSERT INTO organization_members (
      id, organization_id, user_id, member_role, active, created_at
    ) VALUES (?, ?, ?, ?, 1, ?)
  `)

  const now = new Date().toISOString()

  const orgs = [
    {
      id: 'org-company-1',
      kind: 'company',
      name: 'Jubail Home Care Co.',
      name_ar: 'شركة الجبيل للعناية المنزلية',
      city_id: 'jubail',
      phone: '+966133600100',
      email: 'ops@jubailhomecare.sa',
      commercial_registration: '2055001234',
      license_number: 'JBL-MNT-2024-88',
      status: 'active',
    },
    {
      id: 'org-indie-1',
      kind: 'independent',
      name: 'Mohammed Al Otaibi (Independent)',
      name_ar: 'محمد العتيبي (مستقل)',
      city_id: 'jubail',
      phone: '+966501112233',
      email: 'tech@darfix.sa',
      commercial_registration: null,
      license_number: 'FREELANCE-JBL-01',
      status: 'active',
    },
    {
      id: 'org-indie-2',
      kind: 'independent',
      name: 'Nasser Al Dosari (Independent)',
      name_ar: 'ناصر الدوسري (مستقل)',
      city_id: 'jubail',
      phone: '+966507778899',
      email: 'nasser@darfix.sa',
      commercial_registration: null,
      license_number: 'FREELANCE-JBL-02',
      status: 'active',
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
      city_id: 'jubail',
      district_id: 'fanateer',
      specialties: null,
      rating: null,
      review_count: 0,
      active: 1,
      avatar_color: '#14B8A6',
      employment_type: null,
      organization_id: null,
    },
    {
      id: 'cust-2',
      role: 'customer',
      name: 'Fahad Al Qahtani',
      name_ar: 'فهد القحطاني',
      email: 'fahad@example.sa',
      phone: '+966598765432',
      city_id: 'jubail',
      district_id: 'huwaylat',
      specialties: null,
      rating: null,
      review_count: 0,
      active: 1,
      avatar_color: '#0D9488',
      employment_type: null,
      organization_id: null,
    },
    {
      id: 'provider-1',
      role: 'provider',
      name: 'Hassan Al Mutairi',
      name_ar: 'حسن المطيري',
      email: 'company@darfix.sa',
      phone: '+966501001001',
      city_id: 'jubail',
      district_id: 'industrial',
      specialties: null,
      rating: null,
      review_count: 0,
      active: 1,
      avatar_color: '#0F766E',
      employment_type: 'company',
      organization_id: 'org-company-1',
    },
    {
      id: 'tech-1',
      role: 'technician',
      name: 'Mohammed Al Otaibi',
      name_ar: 'محمد العتيبي',
      email: 'tech@darfix.sa',
      phone: '+966501112233',
      city_id: 'jubail',
      district_id: 'fanateer',
      specialties: JSON.stringify(['plumbing', 'electrical']),
      rating: 4.8,
      review_count: 126,
      active: 1,
      avatar_color: '#0B3A4A',
      employment_type: 'independent',
      organization_id: 'org-indie-1',
    },
    {
      id: 'tech-2',
      role: 'technician',
      name: 'Khalid Al Ghamdi',
      name_ar: 'خالد الغامدي',
      email: 'khalid@darfix.sa',
      phone: '+966504445566',
      city_id: 'jubail',
      district_id: 'balad',
      specialties: JSON.stringify(['plumbing']),
      rating: 4.6,
      review_count: 89,
      active: 1,
      avatar_color: '#156074',
      employment_type: 'company',
      organization_id: 'org-company-1',
    },
    {
      id: 'tech-3',
      role: 'technician',
      name: 'Nasser Al Dosari',
      name_ar: 'ناصر الدوسري',
      email: 'nasser@darfix.sa',
      phone: '+966507778899',
      city_id: 'jubail',
      district_id: 'dafi',
      specialties: JSON.stringify(['electrical']),
      rating: 4.9,
      review_count: 64,
      active: 1,
      avatar_color: '#0F4A5C',
      employment_type: 'independent',
      organization_id: 'org-indie-2',
    },
    {
      id: 'tech-4',
      role: 'technician',
      name: 'Yousef Al Shammari',
      name_ar: 'يوسف الشمري',
      email: 'yousef@jubailhomecare.sa',
      phone: '+966509998877',
      city_id: 'jubail',
      district_id: 'industrial',
      specialties: JSON.stringify(['plumbing', 'electrical']),
      rating: 4.7,
      review_count: 41,
      active: 1,
      avatar_color: '#115E59',
      employment_type: 'company',
      organization_id: 'org-company-1',
    },
    {
      id: 'admin-1',
      role: 'admin',
      name: 'DARFIX Admin',
      name_ar: 'مسؤول دارفكس',
      email: 'admin@darfix.sa',
      phone: '+966500000001',
      city_id: 'jubail',
      district_id: null,
      specialties: null,
      rating: null,
      review_count: 0,
      active: 1,
      avatar_color: '#061820',
      employment_type: null,
      organization_id: null,
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
    insertMember.run('mem-4', 'org-indie-1', 'tech-1', 'owner', now)
    insertMember.run('mem-5', 'org-indie-2', 'tech-3', 'owner', now)

    const processOnWay: BookingProcess = {
      ...emptyProcess(),
      estimatedArrival: new Date(Date.now() + 25 * 60000).toISOString(),
      currentStepNote: 'Technician departed Fanateer — ETA ~25 minutes',
      workChecklist: defaultChecklist('plumbing'),
      technicianNotes: [
        {
          id: 'pn-1',
          at: hoursAgo(2),
          text: 'Accepted job. Heading from Fanateer with spare fittings.',
          authorId: 'tech-1',
        },
      ],
    }

    const processAwaiting: BookingProcess = {
      ...emptyProcess(),
      arrivedAt: daysAgo(3),
      startedAt: daysAgo(3),
      currentStepNote: 'Waiting for customer approval on heating element',
      workChecklist: defaultChecklist('plumbing').map((c, i) => ({
        ...c,
        done: i < 2,
      })),
      technicianNotes: [
        {
          id: 'pn-2',
          at: hoursAgo(8),
          text: 'Diagnosed failed heating element. Quoted SAR 220 for replacement.',
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
        id, customer_id, technician_id, organization_id, assignment_mode,
        category_id, problem_id, description, photos,
        address, preferred_date, preferred_time_slot, estimated_fee_sar, status, costs,
        extra_work, job_report, rating, review_text, reviewed_at, discount_code,
        discount_amount_sar, process, status_history, created_at, updated_at
      ) VALUES (
        @id, @customer_id, @technician_id, @organization_id, @assignment_mode,
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
      category_id: 'plumbing',
      problem_id: 'water-leaks',
      description: 'Kitchen sink pipe is leaking under the cabinet. Water pooling overnight.',
      photos: '[]',
      address: JSON.stringify({
        cityId: 'jubail',
        districtId: 'fanateer',
        street: 'King Fahd Coastal Rd, Building 12, Apt 5',
        lat: 27.021,
        lng: 49.655,
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
        { status: 'on_the_way', at: hoursAgo(2), by: 'tech-1', note: 'Departed Fanateer' },
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
      category_id: 'electrical',
      problem_id: 'switch-socket',
      description: 'Living room sockets not working. Breaker trips when used.',
      photos: '[]',
      address: JSON.stringify({
        cityId: 'jubail',
        districtId: 'fanateer',
        street: 'King Fahd Coastal Rd, Building 12, Apt 5',
        lat: 27.021,
        lng: 49.655,
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
      category_id: 'plumbing',
      problem_id: 'blocked-drains',
      description: 'Bathroom drain completely blocked. Slow for days then stopped.',
      photos: '[]',
      address: JSON.stringify({
        cityId: 'jubail',
        districtId: 'huwaylat',
        street: 'Prince Nayef St, Villa 8',
        lat: 27.005,
        lng: 49.662,
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
        currentStepNote: 'Assigned to Jubail Home Care pool — awaiting named technician',
      }),
      status_history: JSON.stringify([
        { status: 'new_request', at: hoursAgo(5) },
        { status: 'confirmed', at: hoursAgo(4), by: 'admin-1' },
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
      category_id: 'plumbing',
      problem_id: 'water-heater',
      description: 'Water heater not heating. Unit is 4 years old.',
      photos: '[]',
      address: JSON.stringify({
        cityId: 'jubail',
        districtId: 'huwaylat',
        street: 'Prince Nayef St, Villa 8',
        lat: 27.005,
        lng: 49.662,
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

    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title_en, title_ar, body_en, body_ar, booking_id, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'n1',
      'cust-1',
      'on_the_way',
      'Technician on the way',
      'الفني في الطريق',
      'Mohammed is heading to your Jubail location for booking #bk-1001.',
      'محمد في الطريق إلى موقعك في الجبيل للحجز #bk-1001.',
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
      'general',
      'Pool job awaiting technician',
      'مهمة في انتظار فني',
      'Booking #bk-1003 is in your company pool — assign a technician.',
      'الحجز #bk-1003 في مجموعة شركتك — عيّن فنياً.',
      'bk-1003',
      0,
      hoursAgo(4),
    )

    db.prepare(
      `INSERT INTO quotations (id, booking_id, lines, total_sar, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      'q-1',
      'bk-1004',
      JSON.stringify([
        { id: 'ql1', label: 'Diagnostic fee', amountSar: 180, type: 'fee' },
        { id: 'ql2', label: 'Heating element', amountSar: 220, type: 'materials' },
      ]),
      400,
      'sent',
      hoursAgo(8),
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
    ).run('dc-1', 'JUBAIL20', 20, 1, 100, 12)
    db.prepare(
      `INSERT INTO discount_codes (id, code, percent_off, active, max_uses, used_count) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('dc-2', 'WELCOME15', 15, 1, 50, 8)

    db.prepare(`INSERT INTO meta (key, value) VALUES ('seeded', ?)`).run(now)
    db.prepare(`INSERT INTO meta (key, value) VALUES ('seed_version', ?)`).run(SEED_VERSION)
    db.prepare(`INSERT INTO meta (key, value) VALUES ('launch_city', ?)`).run('jubail')
  })

  tx()
  return true
}

export { DEMO_PASSWORD, uid }
