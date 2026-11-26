import type { Booking, Invoice, LeadOffer, User } from '../store/types'

export type DayPoint = { day: string; jobs: number; completed: number; revenue: number; leads: number }
export type StatusSlice = { name: string; value: number; fill: string }
export type TechBar = { name: string; active: number; done: number }

const STATUS_COLORS: Record<string, string> = {
  new_request: '#94A3B8',
  confirmed: '#38BDF8',
  technician_assigned: '#2DD4BF',
  on_the_way: '#14B8A6',
  arrived: '#0D9488',
  in_progress: '#F59E0B',
  completed: '#10B981',
  cancelled: '#F87171',
  awaiting_payment: '#A78BFA',
}

function dayKey(iso: string) {
  return iso.slice(0, 10)
}

/** Last N calendar days inclusive of today (UTC date string). */
export function lastNDays(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function buildDailySeries(
  bookings: Booking[],
  invoices: Invoice[],
  leadOffers: LeadOffer[],
  days = 14,
): DayPoint[] {
  const keys = lastNDays(days)
  return keys.map((day) => {
    const dayBookings = bookings.filter(
      (b) => dayKey(b.createdAt) === day || b.preferredDate === day,
    )
    const completed = dayBookings.filter((b) => b.status === 'completed').length
    const revenueAlt = invoices
      .filter((inv) => {
        if (inv.status !== 'paid') return false
        if (dayKey(inv.createdAt) === day) return true
        const b = bookings.find((x) => x.id === inv.bookingId)
        return Boolean(b && dayKey(b.createdAt) === day)
      })
      .reduce((s, inv) => s + inv.totalSar, 0)
    const leads = leadOffers.filter((o) => dayKey(o.offeredAt) === day).length
    return {
      day: day.slice(5),
      jobs: dayBookings.length,
      completed,
      revenue: Math.round(revenueAlt),
      leads,
    }
  })
}

export function buildStatusPie(bookings: Booking[], locale: 'en' | 'ar'): StatusSlice[] {
  const counts = new Map<string, number>()
  for (const b of bookings) {
    counts.set(b.status, (counts.get(b.status) || 0) + 1)
  }
  const labels: Record<string, { en: string; ar: string }> = {
    new_request: { en: 'New', ar: 'جديد' },
    confirmed: { en: 'Confirmed', ar: 'مؤكد' },
    technician_assigned: { en: 'Assigned', ar: 'معيّن' },
    on_the_way: { en: 'On the way', ar: 'في الطريق' },
    arrived: { en: 'Arrived', ar: 'وصل' },
    in_progress: { en: 'In progress', ar: 'قيد التنفيذ' },
    completed: { en: 'Completed', ar: 'مكتمل' },
    cancelled: { en: 'Cancelled', ar: 'ملغى' },
    awaiting_payment: { en: 'Awaiting pay', ar: 'بانتظار الدفع' },
  }
  return [...counts.entries()]
    .map(([status, value]) => ({
      name: labels[status]?.[locale] || status,
      value,
      fill: STATUS_COLORS[status] || '#64748B',
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
}

export function buildTechBars(
  bookings: Booking[],
  techs: User[],
  locale: 'en' | 'ar',
): TechBar[] {
  return techs.slice(0, 8).map((tech) => {
    const mine = bookings.filter((b) => b.technicianId === tech.id)
    return {
      name: (locale === 'ar' ? tech.nameAr || tech.name : tech.name).slice(0, 12),
      active: mine.filter((b) => !['completed', 'cancelled'].includes(b.status)).length,
      done: mine.filter((b) => b.status === 'completed').length,
    }
  })
}

export type TimelineEvent = {
  id: string
  at: string
  kind: 'lead' | 'job' | 'alert' | 'quote' | 'complete'
  title: string
  detail: string
  bookingId?: string
  status?: string
}

export function buildTimeline(opts: {
  bookings: Booking[]
  leadOffers: LeadOffer[]
  locale: 'en' | 'ar'
  categoryLabel: (id: string) => string
  search: string
}): TimelineEvent[] {
  const labelOf = (id: string) => opts.categoryLabel(id)
  const q = opts.search.trim().toLowerCase()
  const events: TimelineEvent[] = []

  for (const o of opts.leadOffers) {
    events.push({
      id: `lead-${o.id}`,
      at: o.offeredAt,
      kind: 'lead',
      title: opts.locale === 'ar' ? 'عرض طلب وارد' : 'Lead offered',
      detail: `${o.bookingId} · ${o.status}`,
      bookingId: o.bookingId,
      status: o.status,
    })
  }
  for (const b of opts.bookings) {
    events.push({
      id: `job-${b.id}`,
      at: b.createdAt,
      kind: b.status === 'completed' ? 'complete' : 'job',
      title: `${labelOf(b.categoryId)} · ${b.status}`,
      detail: `${b.id} · ${b.address?.street || b.preferredDate}`,
      bookingId: b.id,
      status: b.status,
    })
    for (const h of b.statusHistory || []) {
      events.push({
        id: `hist-${b.id}-${h.at}-${h.status}`,
        at: h.at,
        kind: 'job',
        title: opts.locale === 'ar' ? `تحديث حالة` : 'Status update',
        detail: `${b.id} → ${h.status}${h.note ? `: ${h.note}` : ''}`,
        bookingId: b.id,
        status: h.status,
      })
    }
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  if (!q) return events.slice(0, 80)
  return events
    .filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        (e.bookingId || '').toLowerCase().includes(q) ||
        (e.status || '').toLowerCase().includes(q),
    )
    .slice(0, 80)
}

/** Lightweight “AI” report composer from a natural-language ask + metrics. */
export function composeReportStory(opts: {
  prompt: string
  locale: 'en' | 'ar'
  metrics: {
    jobsToday: number
    pendingLeads: number
    activeTechs: number
    overdue: number
    revenue: number
    completed: number
    open: number
  }
  orgName: string
}): { title: string; sections: { heading: string; body: string }[]; focus: string[] } {
  const p = opts.prompt.toLowerCase()
  const focus: string[] = []
  if (/revenue|دخل|إيراد|مبيعات|money|sar/.test(p)) focus.push('revenue')
  if (/lead|عرض|طلب|inbox/.test(p)) focus.push('leads')
  if (/tech|فني|team|فريق/.test(p)) focus.push('techs')
  if (/delay|متأخر|overdue|خطر|risk|sla/.test(p)) focus.push('risk')
  if (/week|أسبوع|daily|يوم|trend|اتجاه/.test(p)) focus.push('trend')
  if (/complete|مكتمل|done/.test(p)) focus.push('completion')
  if (focus.length === 0) focus.push('overview', 'trend', 'risk')

  const m = opts.metrics
  const ar = opts.locale === 'ar'
  const title = ar
    ? `تقرير برج التحكم — ${opts.orgName}`
    : `Control Tower report — ${opts.orgName}`

  const sections: { heading: string; body: string }[] = []

  if (focus.includes('overview') || focus.length > 2) {
    sections.push({
      heading: ar ? 'قصة اليوم' : "Today's story",
      body: ar
        ? `اليوم سجلت ${m.jobsToday} مهام، مع ${m.pendingLeads} عروض معلّقة و${m.activeTechs} فنيين نشطين. الإيراد المدفوع المرتبط: ${m.revenue} ر.س. المهام المفتوحة ${m.open} والمكتملة ${m.completed}.`
        : `Today you logged ${m.jobsToday} jobs, with ${m.pendingLeads} pending leads and ${m.activeTechs} active technicians. Paid revenue attributed: SAR ${m.revenue}. Open jobs ${m.open}; completed ${m.completed}.`,
    })
  }
  if (focus.includes('revenue')) {
    sections.push({
      heading: ar ? 'الإيرادات' : 'Revenue pulse',
      body: ar
        ? `الإيراد المدفوع الحالي ${m.revenue} ر.س. ركّز على إغلاق العروض المعلّقة وتحويل التسعير المعتمد إلى فواتير مدفوعة.`
        : `Paid revenue sits at SAR ${m.revenue}. Prioritize converting accepted leads and approved quotes into paid invoices.`,
    })
  }
  if (focus.includes('leads')) {
    sections.push({
      heading: ar ? 'محرك العروض' : 'Lead engine',
      body: ar
        ? `لديك ${m.pendingLeads} عروضاً بانتظار الرد. الاستجابة السريعة قبل الموعد النهائي تحمي ندرة الطلب وتحسّن معدل القبول.`
        : `You have ${m.pendingLeads} leads awaiting a response. Fast accept/decline before deadlines protects scarce demand and fill-rate.`,
    })
  }
  if (focus.includes('techs')) {
    sections.push({
      heading: ar ? 'فريق الميدان' : 'Field team',
      body: ar
        ? `${m.activeTechs} فنيون على مهام نشطة. راقب توزيع الحمل عبر المخطط الشريطي وأعد التوزيع عند ضغط SLA.`
        : `${m.activeTechs} technicians are on active jobs. Use the workload bar chart to rebalance when SLA pressure rises.`,
    })
  }
  if (focus.includes('risk') || m.overdue > 0) {
    sections.push({
      heading: ar ? 'المخاطر والتنبيهات' : 'Risk & alerts',
      body: ar
        ? `${m.overdue} عناصر متأخرة أو معرضة للخطر. برج التحكم يوصي بالمتابعة أو إعادة التعيين بموافقة بشرية.`
        : `${m.overdue} items look overdue or at risk. Control Tower recommends follow-up or reassignment with human approval.`,
    })
  }
  if (focus.includes('trend') || focus.includes('completion')) {
    sections.push({
      heading: ar ? 'الاتجاه والإنجاز' : 'Trend & completion',
      body: ar
        ? `استخدم مخطط الخطوط لآخر ١٤ يوماً: قارن المهام الواردة بالمكتملة. الإنجاز التراكمي ${m.completed} مقابل المفتوح ${m.open}.`
        : `Use the 14-day line chart to compare inflow vs completed. Cumulative completed ${m.completed} vs open ${m.open}.`,
    })
  }

  sections.push({
    heading: ar ? 'الخطوة التالية' : 'Next move',
    body: ar
      ? 'اطبع أو حمّل هذا التقرير، ثم نفّذ تنبيهات برج التحكم ذات الأولوية القصوى قبل نهاية اليوم.'
      : 'Print or download this report, then clear the highest-priority Control Tower alerts before end of day.',
  })

  return { title, sections, focus }
}
