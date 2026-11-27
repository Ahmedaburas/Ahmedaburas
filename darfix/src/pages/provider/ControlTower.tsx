import {
  Download,
  FileText,
  Printer,
  Radar,
  Search,
  Sparkles,
  AlertTriangle,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState } from '../../components/EmptyState'
import { useI18n } from '../../i18n'
import {
  buildDailySeries,
  buildStatusPie,
  buildTechBars,
  buildTimeline,
  composeReportStory,
} from '../../lib/towerMetrics'
import { useStore } from '../../store/store'

const CHART_TEAL = '#14B8A6'
const CHART_NAVY = '#0B3A4A'
const CHART_AMBER = '#F59E0B'
const CHART_SKY = '#38BDF8'

export function ProviderControlTower() {
  const { state, currentUser } = useStore()
  const { t, locale, displayName, categoryLabel, formatSar } = useI18n()
  const reportRef = useRef<HTMLDivElement>(null)

  const org = state.organizations.find((o) => o.id === currentUser?.organizationId)
  const [timelineQuery, setTimelineQuery] = useState('')
  const [reportPrompt, setReportPrompt] = useState(
    locale === 'ar'
      ? 'لخّص الإيرادات والمخاطر والعروض لهذا الأسبوع'
      : 'Summarize revenue, risks, and leads for this week',
  )
  const [story, setStory] = useState<ReturnType<typeof composeReportStory> | null>(null)

  const memberTechs = useMemo(() => {
    const memberIds = new Set(
      state.organizationMembers
        .filter((m) => m.organizationId === currentUser?.organizationId && m.active)
        .map((m) => m.userId),
    )
    return state.users.filter((u) => u.role === 'technician' && memberIds.has(u.id) && (u.active ?? true))
  }, [state.organizationMembers, state.users, currentUser?.organizationId])

  const orgBookings = useMemo(() => {
    if (!org) return []
    return state.bookings.filter(
      (b) =>
        b.organizationId === org.id ||
        state.leadOffers.some((o) => o.bookingId === b.id && o.organizationId === org.id),
    )
  }, [state.bookings, state.leadOffers, org])

  const orgLeads = useMemo(
    () => state.leadOffers.filter((o) => o.organizationId === org?.id),
    [state.leadOffers, org?.id],
  )

  const orgInvoices = useMemo(
    () => state.invoices.filter((inv) => orgBookings.some((b) => b.id === inv.bookingId)),
    [state.invoices, orgBookings],
  )

  const today = new Date().toISOString().slice(0, 10)
  const jobsToday = orgBookings.filter(
    (b) => b.preferredDate === today || b.createdAt.slice(0, 10) === today,
  ).length
  const openLeads = orgLeads.filter((o) => o.status === 'offered')
  const activeTechs = memberTechs.filter((tech) =>
    orgBookings.some(
      (b) => b.technicianId === tech.id && !['completed', 'cancelled'].includes(b.status),
    ),
  ).length
  const overdue = orgBookings.filter((b) => {
    if (['completed', 'cancelled'].includes(b.status)) return false
    return new Date(b.preferredDate).getTime() < Date.now() - 86400000
  }).length
  const revenue = orgInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((s, inv) => s + inv.totalSar, 0)
  const completed = orgBookings.filter((b) => b.status === 'completed').length
  const open = orgBookings.filter((b) => !['completed', 'cancelled'].includes(b.status)).length

  const daily = useMemo(
    () => buildDailySeries(orgBookings, orgInvoices, orgLeads, 14),
    [orgBookings, orgInvoices, orgLeads],
  )
  const pie = useMemo(() => buildStatusPie(orgBookings, locale), [orgBookings, locale])
  const techBars = useMemo(
    () => buildTechBars(orgBookings, memberTechs, locale),
    [orgBookings, memberTechs, locale],
  )
  const timeline = useMemo(
    () =>
      buildTimeline({
        bookings: orgBookings,
        leadOffers: orgLeads,
        locale,
        categoryLabel: (id) => categoryLabel(id as 'plumbing' | 'electrical'),
        search: timelineQuery,
      }),
    [orgBookings, orgLeads, locale, categoryLabel, timelineQuery],
  )

  const towerAlerts = useMemo(() => {
    const alerts: { id: string; kind: 'no_response' | 'delay' | 'opportunity'; title: string; action: string }[] =
      []
    for (const offer of openLeads) {
      if (new Date(offer.deadlineAt).getTime() - Date.now() < 3600000) {
        alerts.push({
          id: `nr-${offer.id}`,
          kind: 'no_response',
          title: `${t('alertNoResponse')}: ${offer.bookingId}`,
          action: t('acceptLead'),
        })
      }
    }
    for (const b of orgBookings) {
      if (b.status === 'confirmed' && !b.technicianId) {
        alerts.push({
          id: `delay-${b.id}`,
          kind: 'delay',
          title: `${t('alertDelay')}: ${b.id}`,
          action: t('assignTechnician'),
        })
      }
    }
    if (overdue > 0) {
      alerts.push({
        id: 'opp-overdue',
        kind: 'opportunity',
        title: `${t('alertOpportunity')}: ${overdue} ${t('overdue').toLowerCase()}`,
        action: t('recommendedAction'),
      })
    }
    return alerts.slice(0, 6)
  }, [openLeads, orgBookings, overdue, t])

  function runAiReport() {
    if (!org) return
    setStory(
      composeReportStory({
        prompt: reportPrompt,
        locale,
        orgName: displayName(org.name, org.nameAr),
        metrics: {
          jobsToday,
          pendingLeads: openLeads.length,
          activeTechs,
          overdue,
          revenue,
          completed,
          open,
        },
      }),
    )
  }

  function downloadReport() {
    if (!story || !reportRef.current) return
    const html = `<!DOCTYPE html><html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><title>${story.title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;color:#0B3A4A;line-height:1.5}
h1{color:#0B3A4A}h2{color:#0D9488;margin-top:1.5rem}.meta{color:#64748b;font-size:12px}</style></head><body>
<h1>${story.title}</h1>
<p class="meta">${new Date().toLocaleString()} · DARFIX Control Tower</p>
${story.sections.map((s) => `<h2>${s.heading}</h2><p>${s.body}</p>`).join('')}
</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `darfix-control-tower-${today}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadCsv() {
    const rows = [
      ['metric', 'value'],
      ['jobsToday', String(jobsToday)],
      ['pendingLeads', String(openLeads.length)],
      ['activeTechs', String(activeTechs)],
      ['overdue', String(overdue)],
      ['revenueSar', String(revenue)],
      ['completed', String(completed)],
      ['open', String(open)],
      ...daily.map((d) => [`day_${d.day}_jobs`, String(d.jobs)]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `darfix-ops-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!org) {
    return <EmptyState title={t('emptyTowerOrgTitle')} description={t('emptyTowerOrgDesc')} />
  }

  return (
    <div className="space-y-8 animate-[fade-up_0.4s_ease-out]">
      <div className="relative overflow-hidden rounded-3xl border border-navy-900/10 bg-gradient-to-br from-navy-950 via-navy-900 to-teal-600/40 p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-400/20 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-amber-400/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-teal-300">
              <Radar className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">{t('controlTower')}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {displayName(org.name, org.nameAr)}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/70">{t('towerStorySub')}</p>
          </div>
          <Link to="/provider" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/15">
            {t('dashboard')}
          </Link>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: t('jobsToday'), value: jobsToday, accent: 'from-teal-400/30' },
            { label: t('pendingLeads'), value: openLeads.length, accent: 'from-sky-400/30' },
            { label: t('activeTechs'), value: activeTechs, accent: 'from-emerald-400/30' },
            { label: t('overdue'), value: overdue, accent: 'from-amber-400/30' },
            { label: t('revenue'), value: formatSar(revenue), accent: 'from-violet-400/30' },
          ].map((m) => (
            <div
              key={m.label}
              className={`rounded-2xl border border-white/10 bg-gradient-to-br ${m.accent} to-transparent p-4 backdrop-blur`}
            >
              <p className="text-[11px] uppercase tracking-wide text-white/55">{m.label}</p>
              <p className="mt-1 text-2xl font-bold">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts strip */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {towerAlerts.length === 0 ? (
          <div className="card-surface col-span-full p-4 text-sm text-navy-700/60">{t('towerAllClear')}</div>
        ) : (
          towerAlerts.map((a) => (
            <div
              key={a.id}
              className={`rounded-2xl border p-4 ${
                a.kind === 'delay'
                  ? 'border-amber-200 bg-amber-50'
                  : a.kind === 'no_response'
                    ? 'border-sky-200 bg-sky-50'
                    : 'border-teal-200 bg-teal-50'
              }`}
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-900">
                {a.kind === 'no_response' && <Clock className="h-4 w-4 text-sky-600" />}
                {a.kind === 'delay' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                {a.kind === 'opportunity' && <TrendingUp className="h-4 w-4 text-teal-600" />}
                {a.title}
              </div>
              <p className="text-xs text-navy-700/70">
                {t('recommendedAction')}: {a.action}
              </p>
            </div>
          ))
        )}
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-5">
          <h2 className="mb-1 text-lg font-semibold text-navy-900">{t('towerJobsTrend')}</h2>
          <p className="mb-4 text-xs text-navy-700/50">{t('towerJobsTrendSub')}</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6F0F3" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="jobs" name={t('bookings')} stroke={CHART_NAVY} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="completed" name={t('completed')} stroke={CHART_TEAL} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="leads" name={t('pendingLeads')} stroke={CHART_SKY} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface p-5">
          <h2 className="mb-1 text-lg font-semibold text-navy-900">{t('towerRevenueArea')}</h2>
          <p className="mb-4 text-xs text-navy-700/50">{t('towerRevenueAreaSub')}</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_TEAL} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={CHART_TEAL} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6F0F3" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" name={t('revenue')} stroke={CHART_TEAL} fill="url(#revFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface p-5">
          <h2 className="mb-1 text-lg font-semibold text-navy-900">{t('towerStatusMix')}</h2>
          <p className="mb-4 text-xs text-navy-700/50">{t('towerStatusMixSub')}</p>
          <div className="h-64">
            {pie.length === 0 ? (
              <EmptyState title={t('emptyChartTitle')} description={t('emptyChartDesc')} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {pie.map((s) => (
                      <Cell key={s.name} fill={s.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card-surface p-5">
          <h2 className="mb-1 text-lg font-semibold text-navy-900">{t('towerTechLoad')}</h2>
          <p className="mb-4 text-xs text-navy-700/50">{t('towerTechLoadSub')}</p>
          <div className="h-64">
            {techBars.length === 0 ? (
              <EmptyState title={t('emptyChartTitle')} description={t('emptyChartDesc')} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={techBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6F0F3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="active" name={t('activeTechs')} fill={CHART_AMBER} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="done" name={t('completed')} fill={CHART_TEAL} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Searchable timeline */}
      <section className="card-surface p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">{t('towerTimeline')}</h2>
            <p className="text-xs text-navy-700/50">{t('towerTimelineSub')}</p>
          </div>
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-700/40" />
            <input
              className="input-field ps-9"
              placeholder={t('towerSearchPlaceholder')}
              value={timelineQuery}
              onChange={(e) => setTimelineQuery(e.target.value)}
            />
          </div>
        </div>
        <ol className="relative max-h-[420px] space-y-0 overflow-y-auto border-s-2 border-teal-200/80 ms-3">
          {timeline.length === 0 ? (
            <li className="ps-6 py-4">
              <EmptyState title={t('emptyTimelineTitle')} description={t('emptyTimelineDesc')} />
            </li>
          ) : (
            timeline.map((ev) => (
              <li key={ev.id} className="relative ps-6 py-3">
                <span
                  className={`absolute -start-[7px] top-4 h-3 w-3 rounded-full border-2 border-white ${
                    ev.kind === 'lead'
                      ? 'bg-sky-500'
                      : ev.kind === 'complete'
                        ? 'bg-emerald-500'
                        : ev.kind === 'alert'
                          ? 'bg-amber-500'
                          : 'bg-teal-500'
                  }`}
                />
                <p className="text-[11px] text-navy-700/45">{new Date(ev.at).toLocaleString()}</p>
                <p className="font-semibold text-navy-900">{ev.title}</p>
                <p className="text-sm text-navy-700/70">{ev.detail}</p>
              </li>
            ))
          )}
        </ol>
      </section>

      {/* AI report studio */}
      <section className="overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-[0_1px_3px_rgba(11,58,74,0.04)]">
        <div className="border-b border-navy-50 bg-gradient-to-r from-teal-50 via-white to-amber-50 px-5 py-4">
          <div className="flex items-center gap-2 text-teal-700">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-navy-900">{t('towerReportStudio')}</h2>
          </div>
          <p className="mt-1 text-sm text-navy-700/60">{t('towerReportStudioSub')}</p>
        </div>
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="space-y-3 border-b border-navy-50 p-5 lg:border-b-0 lg:border-e">
            <label className="label-text">{t('towerAskAi')}</label>
            <textarea
              className="input-field min-h-[120px] resize-y"
              value={reportPrompt}
              onChange={(e) => setReportPrompt(e.target.value)}
              placeholder={t('towerAskAiPlaceholder')}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={runAiReport}>
                <Sparkles className="h-4 w-4" />
                {t('towerGenerateReport')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={!story}
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />
                {t('towerPrint')}
              </button>
              <button type="button" className="btn-secondary" disabled={!story} onClick={downloadReport}>
                <Download className="h-4 w-4" />
                {t('towerDownloadHtml')}
              </button>
              <button type="button" className="btn-ghost" onClick={downloadCsv}>
                <FileText className="h-4 w-4" />
                {t('towerDownloadCsv')}
              </button>
            </div>
          </div>
          <div ref={reportRef} className="tower-print-area bg-sand-50/50 p-5">
            {!story ? (
              <p className="text-sm text-navy-700/50">{t('towerReportEmpty')}</p>
            ) : (
              <article className="space-y-4">
                <h3 className="text-xl font-bold text-navy-900">{story.title}</h3>
                <p className="text-xs text-navy-700/45">
                  {new Date().toLocaleString()} · {t('controlTower')}
                </p>
                {story.sections.map((s) => (
                  <div key={s.heading}>
                    <h4 className="font-semibold text-teal-700">{s.heading}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-navy-800/90">{s.body}</p>
                  </div>
                ))}
              </article>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
