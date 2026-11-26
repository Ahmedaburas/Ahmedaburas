import { AlertTriangle, Clock, Radar, TrendingUp, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { EmptyState } from '../../components/EmptyState'
import { StatusBadge } from '../../components/StatusBadge'
import { useI18n } from '../../i18n'
import { useStore } from '../../store/store'
import { SUBSCRIPTION_PLANS } from '../../store/types'

export function ProviderHome() {
  const { state, currentUser, actions } = useStore()
  const { t, locale, displayName, categoryLabel, problemLabel, formatSar } = useI18n()
  const org = state.organizations.find((o) => o.id === currentUser?.organizationId)
  const memberTechs = useMemo(() => {
    const memberIds = new Set(
      state.organizationMembers
        .filter((m) => m.organizationId === currentUser?.organizationId && m.active)
        .map((m) => m.userId),
    )
    return state.users.filter((u) => u.role === 'technician' && memberIds.has(u.id) && (u.active ?? true))
  }, [state.organizationMembers, state.users, currentUser?.organizationId])

  const [assignMap, setAssignMap] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [seats, setSeats] = useState<{
    used: number
    max: number | null
    atLimit: boolean
    trialEndsAt: string | null
    paywall?: boolean
    subscriptionStatus?: string
  } | null>(null)
  const [campaigns, setCampaigns] = useState<
    { id: string; titleEn: string; titleAr: string; window: string; offerIdea: string }[]
  >([])
  const [inviteError, setInviteError] = useState('')
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  })

  useEffect(() => {
    void api.orgSeats().then((s) =>
      setSeats({
        used: s.used,
        max: s.max,
        atLimit: s.atLimit,
        trialEndsAt: s.trialEndsAt,
        paywall: s.paywall,
        subscriptionStatus: s.subscriptionStatus,
      }),
    ).catch(() => undefined)
    void api.campaignSuggestions().then((r) => setCampaigns(r.suggestions.slice(0, 4))).catch(() => undefined)
  }, [org?.id, memberTechs.length])

  const today = new Date().toISOString().slice(0, 10)
  const orgBookings = state.bookings.filter(
    (b) => b.organizationId === org?.id || state.leadOffers.some(
      (o) => o.bookingId === b.id && o.organizationId === org?.id && o.status === 'offered',
    ),
  )
  const jobsToday = orgBookings.filter(
    (b) => b.preferredDate === today || b.createdAt.slice(0, 10) === today,
  ).length
  const openLeads = state.leadOffers.filter(
    (o) => o.organizationId === org?.id && o.status === 'offered',
  )
  const activeTechs = memberTechs.filter((tech) =>
    orgBookings.some(
      (b) =>
        b.technicianId === tech.id &&
        !['completed', 'cancelled'].includes(b.status),
    ),
  ).length
  const overdue = orgBookings.filter((b) => {
    if (['completed', 'cancelled'].includes(b.status)) return false
    const pref = new Date(b.preferredDate).getTime()
    return pref < Date.now() - 86400000
  }).length
  const revenue = state.invoices
    .filter((inv) => orgBookings.some((b) => b.id === inv.bookingId) && inv.status === 'paid')
    .reduce((s, inv) => s + inv.totalSar, 0)

  const pendingQuotes = state.quotations.filter(
    (q) =>
      q.status === 'pending_company_approval' &&
      orgBookings.some((b) => b.id === q.bookingId),
  )

  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === (org?.subscriptionPlan || 'launch'))

  const towerAlerts = useMemo(() => {
    const alerts: {
      id: string
      kind: 'no_response' | 'delay' | 'opportunity'
      title: string
      action: string
      bookingId?: string
    }[] = []
    for (const offer of openLeads) {
      const msLeft = new Date(offer.deadlineAt).getTime() - Date.now()
      if (msLeft < 3600000) {
        alerts.push({
          id: `nr-${offer.id}`,
          kind: 'no_response',
          title: `${t('alertNoResponse')}: ${offer.bookingId}`,
          action: t('acceptLead'),
          bookingId: offer.bookingId,
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
          bookingId: b.id,
        })
      }
    }
    if (pendingQuotes.length) {
      alerts.push({
        id: 'opp-quotes',
        kind: 'opportunity',
        title: `${t('alertOpportunity')}: ${pendingQuotes.length} ${t('priceApproval').toLowerCase()}`,
        action: t('approve'),
      })
    }
    return alerts.slice(0, 5)
  }, [openLeads, orgBookings, pendingQuotes.length, t])

  if (!org) {
    return <EmptyState title={t('noData')} />
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">
            {displayName(org.name, org.nameAr)}
          </h1>
          <p className="mt-1 text-sm text-navy-700/60">
            {t('easternProvince')} · {t('controlTower')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {org.foundingPartner && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              {t('foundingPartners')}
            </span>
          )}
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
            {t('planBadge')}: {locale === 'ar' ? plan?.nameAr : plan?.nameEn}
            {plan?.maxTechnicians != null
              ? ` · ${seats?.used ?? memberTechs.length}/${plan.maxTechnicians} ${t('technicianSeats').toLowerCase()}`
              : ''}
          </span>
          {(seats?.trialEndsAt || org.trialEndsAt) && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              {t('trialEnds')}:{' '}
              {new Date(seats?.trialEndsAt || org.trialEndsAt!).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {seats?.paywall && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">{t('paywallTitle')}</p>
          <p className="mt-1 text-amber-900/80">{t('paywallBody')}</p>
          <Link to="/provider/billing" className="mt-2 inline-block font-semibold text-teal-800 underline">
            {t('payWithCards')}
          </Link>
        </div>
      )}

      {(seats?.atLimit || (plan?.maxTechnicians != null && memberTechs.length >= plan.maxTechnicians)) && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t('seatLimitReached')} {t('upgradeForSeats')}{' '}
          <Link to="/provider/billing" className="font-semibold text-teal-800 underline">
            {t('billing')}
          </Link>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: t('jobsToday'), value: jobsToday },
          { label: t('pendingLeads'), value: openLeads.length },
          { label: t('activeTechs'), value: activeTechs },
          { label: t('overdue'), value: overdue },
          { label: t('revenue'), value: formatSar(revenue) },
        ].map((m) => (
          <div key={m.label} className="card-surface p-4">
            <p className="text-xs uppercase tracking-wide text-navy-700/45">{m.label}</p>
            <p className="mt-1 text-2xl font-bold text-navy-900">{m.value}</p>
          </div>
        ))}
      </div>

      {/* AI Control Tower teaser → full visual tower */}
      <section className="rounded-2xl border border-navy-900/10 bg-gradient-to-br from-navy-900 to-navy-800 p-5 text-white">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-teal-300" />
            <div>
              <h2 className="font-semibold">{t('controlTower')}</h2>
              <p className="text-xs text-white/55">{t('controlTowerSub')}</p>
            </div>
          </div>
          <Link
            to="/provider/control-tower"
            className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-400"
          >
            {t('towerOpenFull')}
          </Link>
        </div>
        {towerAlerts.length === 0 ? (
          <p className="text-sm text-white/60">{t('towerAllClear')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {towerAlerts.map((a) => (
              <div key={a.id} className="rounded-xl bg-white/8 p-4 backdrop-blur">
                <div className="mb-2 flex items-center gap-2 text-teal-300">
                  {a.kind === 'no_response' && <Clock className="h-4 w-4" />}
                  {a.kind === 'delay' && <AlertTriangle className="h-4 w-4" />}
                  {a.kind === 'opportunity' && <TrendingUp className="h-4 w-4" />}
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {a.kind === 'no_response'
                      ? t('alertNoResponse')
                      : a.kind === 'delay'
                        ? t('alertDelay')
                        : t('alertOpportunity')}
                  </span>
                </div>
                <p className="text-sm text-white/90">{a.title}</p>
                <p className="mt-2 text-xs text-teal-200/80">
                  {t('recommendedAction')}: {a.action}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Company profile + team */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-5">
          <h2 className="text-lg font-semibold text-navy-900">{t('companyProfile')}</h2>
          <dl className="mt-3 space-y-2 text-sm text-navy-700/80">
            <div className="flex justify-between gap-4">
              <dt>{t('commercialRegistration')}</dt>
              <dd className="font-medium text-navy-900">{org.commercialRegistration || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('whatsappBusiness')}</dt>
              <dd className="font-medium text-navy-900">{org.whatsapp || org.phone || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('slaHours')}</dt>
              <dd className="font-medium text-navy-900">{org.slaHours ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('priceApprover')}</dt>
              <dd className="font-medium text-navy-900">{org.priceApproverName || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('serviceCities')}</dt>
              <dd className="font-medium text-navy-900">
                {(org.serviceCityIds || [org.cityId]).join(', ')}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-navy-700/50">{t('orgRolesHint')}</p>
        </div>

        <div className="card-surface p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-navy-900">{t('technicians')}</h2>
          </div>
          <ul className="space-y-2">
            {memberTechs.map((tech) => (
              <li
                key={tech.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sand-50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-navy-900">
                  {displayName(tech.name, tech.nameAr)}
                </span>
                <span className="font-mono text-xs text-teal-700">
                  {tech.technicianCode || '—'}
                </span>
              </li>
            ))}
            {memberTechs.length === 0 && <EmptyState title={t('noData')} />}
          </ul>

          <form
            className="mt-4 space-y-2 border-t border-navy-100 pt-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setInviteError('')
              const result = await actions.inviteTechnician({
                name: inviteForm.name,
                email: inviteForm.email,
                phone: inviteForm.phone,
                password: inviteForm.password,
                cityId: org.cityId,
                specialties: (org.specialties as ('plumbing' | 'electrical')[]) || ['plumbing'],
              })
              if ('error' in result) {
                setInviteError(result.error)
                return
              }
              setInviteForm({ name: '', email: '', phone: '', password: '' })
              setSeats({
                used: result.seats.used,
                max: result.seats.max,
                atLimit: result.seats.max != null && result.seats.used >= result.seats.max,
                trialEndsAt: seats?.trialEndsAt ?? org.trialEndsAt ?? null,
              })
            }}
          >
            <p className="text-sm font-semibold text-navy-900">{t('inviteTechnician')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="input-field"
                placeholder={t('name')}
                required
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
              />
              <input
                className="input-field"
                type="email"
                placeholder={t('email')}
                required
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              />
              <input
                className="input-field"
                placeholder={t('phone')}
                required
                value={inviteForm.phone}
                onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
              />
              <button type="submit" className="btn-primary">
                {t('inviteTechnician')}
              </button>
            </div>
            {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
          </form>
        </div>
      </section>

      {/* Campaign suggestions */}
      {campaigns.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold text-navy-900">{t('campaignIdeas')}</h2>
          <p className="mb-3 text-xs text-navy-700/55">{t('campaignApprovalNote')}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {campaigns.map((c) => (
              <div key={c.id} className="card-surface p-4">
                <p className="text-xs text-navy-700/45">{c.window}</p>
                <p className="mt-1 font-semibold text-navy-900">
                  {locale === 'ar' ? c.titleAr : c.titleEn}
                </p>
                <p className="mt-2 text-sm text-navy-700/70">{c.offerIdea}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lead inbox */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy-900">{t('leadInbox')}</h2>
        {openLeads.length === 0 ? (
          <EmptyState title={t('noData')} />
        ) : (
          <div className="space-y-3">
            {openLeads.map((offer) => {
              const b = state.bookings.find((x) => x.id === offer.bookingId)
              return (
                <div key={offer.id} className="card-surface border-teal-200/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-navy-700/45">{offer.bookingId}</p>
                      <p className="font-semibold text-navy-900">
                        {b
                          ? `${categoryLabel(b.categoryId)} · ${problemLabel(b.categoryId, b.problemId)}`
                          : offer.bookingId}
                      </p>
                      <p className="mt-1 text-sm text-navy-700/60">
                        {t('offerDeadline')}: {new Date(offer.deadlineAt).toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs text-teal-700">{t('limitedCompetition')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy === offer.id}
                        onClick={async () => {
                          setBusy(offer.id)
                          await actions.respondLeadOffer(offer.id, true)
                          setBusy(null)
                        }}
                      >
                        {t('acceptLead')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy === offer.id}
                        onClick={async () => {
                          setBusy(offer.id)
                          await actions.respondLeadOffer(offer.id, false)
                          setBusy(null)
                        }}
                      >
                        {t('declineLead')}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Price approvals */}
      {pendingQuotes.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-navy-900">{t('priceApproval')}</h2>
          <div className="space-y-3">
            {pendingQuotes.map((q) => (
              <div key={q.id} className="card-surface p-4">
                <p className="font-mono text-xs text-navy-700/45">{q.bookingId}</p>
                <p className="font-semibold text-navy-900">
                  {t('pendingCompanyQuote')} · {formatSar(q.totalSar)}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-navy-700/70">
                  {q.lines.map((l) => (
                    <li key={l.id}>
                      {l.label}: {formatSar(l.amountSar)}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void actions.reviewQuotation(q.id, 'approve')}
                  >
                    {t('approve')}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void actions.reviewQuotation(q.id, 'reject')}
                  >
                    {t('reject')}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() =>
                      void actions.reviewQuotation(q.id, 'clarify', 'Please clarify materials line')
                    }
                  >
                    {t('clarify')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pipeline / pool */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy-900">{t('requestPipeline')}</h2>
        {orgBookings.filter((b) => b.organizationId === org.id).length === 0 ? (
          <EmptyState title={t('noData')} />
        ) : (
          <div className="space-y-3">
            {orgBookings
              .filter((b) => b.organizationId === org.id)
              .map((b) => (
                <div key={b.id} className="card-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-navy-700/45">{b.id}</p>
                      <p className="font-semibold text-navy-900">
                        {categoryLabel(b.categoryId)} · {problemLabel(b.categoryId, b.problemId)}
                      </p>
                      <p className="mt-1 text-sm text-navy-700/60">{b.address.street}</p>
                      <p className="mt-1 text-sm text-navy-700/55">{formatSar(b.estimatedFeeSar)}</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>

                  {!b.technicianId || b.assignmentMode === 'company_pool' ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <select
                        className="input-field max-w-xs"
                        value={assignMap[b.id] || ''}
                        onChange={(e) => setAssignMap({ ...assignMap, [b.id]: e.target.value })}
                      >
                        <option value="">— {t('assignTechnician')} —</option>
                        {memberTechs
                          .filter((tech) => tech.specialties?.includes(b.categoryId))
                          .map((tech) => (
                            <option key={tech.id} value={tech.id}>
                              {tech.technicianCode ? `${tech.technicianCode} · ` : ''}
                              {displayName(tech.name, tech.nameAr)}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!assignMap[b.id]}
                        onClick={() => void actions.assignTechnician(b.id, assignMap[b.id])}
                      >
                        {t('assignTechnician')}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-teal-700">
                      {t('technician')}:{' '}
                      {displayName(
                        state.users.find((u) => u.id === b.technicianId)?.name ?? '',
                        state.users.find((u) => u.id === b.technicianId)?.nameAr ?? '',
                      )}
                    </p>
                  )}

                  <Link
                    to={`/provider/bookings/${b.id}`}
                    className="mt-3 inline-block text-sm font-semibold text-teal-600 hover:underline"
                  >
                    {t('viewDetails')}
                  </Link>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  )
}
