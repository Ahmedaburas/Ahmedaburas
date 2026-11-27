import { ArrowLeft, Phone } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ProcessTracker } from '../../components/ProcessTracker'
import { StatusBadge } from '../../components/StatusBadge'
import { useToast } from '../../components/Toast'
import { useI18n } from '../../i18n'
import { useStore } from '../../store/store'

export function ProviderBookingDetail() {
  const { id } = useParams()
  const { state, currentUser, actions } = useStore()
  const { t, displayName, categoryLabel, problemLabel, formatSar } = useI18n()
  const toast = useToast()
  const [assignId, setAssignId] = useState('')
  const [busy, setBusy] = useState(false)

  const booking = state.bookings.find((b) => b.id === id)
  const orgId = currentUser?.organizationId
  const customer = state.users.find((u) => u.id === booking?.customerId)
  const tech = state.users.find((u) => u.id === booking?.technicianId)
  const quotes = state.quotations.filter((q) => q.bookingId === id)

  const memberTechs = useMemo(() => {
    const memberIds = new Set(
      state.organizationMembers
        .filter((m) => m.organizationId === orgId && m.active)
        .map((m) => m.userId),
    )
    return state.users.filter((u) => u.role === 'technician' && memberIds.has(u.id) && (u.active ?? true))
  }, [state.organizationMembers, state.users, orgId])

  if (!booking) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-navy-700/60">{t('bookingNotFound')}</p>
        <Link to="/provider" className="btn-primary mt-4 inline-flex">
          {t('dashboard')}
        </Link>
      </div>
    )
  }

  const allowed =
    booking.organizationId === orgId ||
    state.leadOffers.some((o) => o.bookingId === booking.id && o.organizationId === orgId)
  if (!allowed) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-navy-700/60">{t('bookingNotFound')}</p>
        <Link to="/provider" className="btn-primary mt-4 inline-flex">
          {t('dashboard')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/provider" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        {t('dashboard')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-navy-700/45">
            {categoryLabel(booking.categoryId)}
          </p>
          <h1 className="text-2xl font-bold text-navy-900">
            {problemLabel(booking.categoryId, booking.problemId)}
          </h1>
          <p className="mt-1 font-mono text-sm text-navy-700/50">{booking.id}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <ProcessTracker booking={booking} />

      <div className="card-surface p-5">
        <h2 className="mb-2 font-semibold text-navy-900">{t('customer')}</h2>
        {customer ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-navy-900">
              {displayName(customer.name, customer.nameAr)}
            </span>
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 text-teal-700">
                <Phone className="h-4 w-4" />
                {customer.phone}
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-navy-700/50">{t('noData')}</p>
        )}
        <p className="mt-3 text-sm text-navy-700/70">{booking.address.street}</p>
        <p className="mt-1 text-sm text-navy-700/55">{formatSar(booking.estimatedFeeSar)}</p>
      </div>

      {tech ? (
        <div className="card-surface p-5 text-sm">
          <h2 className="mb-2 font-semibold text-navy-900">{t('technician')}</h2>
          <p>
            {tech.technicianCode ? `${tech.technicianCode} · ` : ''}
            {displayName(tech.name, tech.nameAr)}
          </p>
        </div>
      ) : (
        <div className="card-surface p-5">
          <h2 className="mb-3 font-semibold text-navy-900">{t('assignTechnician')}</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="input-field max-w-xs"
              value={assignId}
              onChange={(e) => setAssignId(e.target.value)}
            >
              <option value="">— {t('assignTechnician')} —</option>
              {memberTechs
                .filter((u) => u.specialties?.includes(booking.categoryId))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.technicianCode ? `${u.technicianCode} · ` : ''}
                    {displayName(u.name, u.nameAr)}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="btn-primary"
              disabled={!assignId || busy}
              onClick={async () => {
                setBusy(true)
                await actions.assignTechnician(booking.id, assignId)
                setBusy(false)
                toast.push(t('toastAssignSuccess'))
              }}
            >
              {t('assignTechnician')}
            </button>
          </div>
        </div>
      )}

      {quotes.length > 0 && (
        <div className="card-surface p-5">
          <h2 className="mb-3 font-semibold text-navy-900">{t('priceApproval')}</h2>
          <ul className="space-y-3">
            {quotes.map((q) => (
              <li key={q.id} className="rounded-xl bg-sand-50 px-3 py-3 text-sm">
                <p className="font-medium text-navy-900">
                  {q.status} · {formatSar(q.totalSar)}
                </p>
                {q.status === 'pending_company_approval' && (
                  <div className="mt-2 flex flex-wrap gap-2">
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
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
