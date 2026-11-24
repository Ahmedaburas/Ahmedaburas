import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StatusBadge } from '../../components/StatusBadge'
import { EmptyState } from '../../components/EmptyState'
import { useI18n } from '../../i18n'
import { useStore } from '../../store/store'
import { BOOKING_STATUSES, type BookingStatus, type CostLine } from '../../store/types'

export function AdminBookings() {
  const { state } = useStore()
  const { t, categoryLabel, problemLabel, formatSar, displayName, statusLabel } = useI18n()
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    return state.bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (q) {
        const customer = state.users.find((u) => u.id === b.customerId)
        const hay = `${b.id} ${customer?.name} ${customer?.email} ${b.problemId}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [state.bookings, state.users, statusFilter, q])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-navy-900">{t('bookings')}</h1>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input-field max-w-xs"
          placeholder={t('search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input-field max-w-xs"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as BookingStatus | 'all')}
        >
          <option value="all">{t('allStatuses')}</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {list.length === 0 ? (
        <EmptyState title={t('noData')} />
      ) : (
        <div className="overflow-x-auto card-surface">
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead className="border-b border-navy-100 bg-sand-50/80 text-xs uppercase tracking-wide text-navy-700/50">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">{t('customerInfo')}</th>
                <th className="px-4 py-3 font-medium">{t('category')}</th>
                <th className="px-4 py-3 font-medium">{t('status')}</th>
                <th className="px-4 py-3 font-medium">{t('fee')}</th>
                <th className="px-4 py-3 font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => {
                const customer = state.users.find((u) => u.id === b.customerId)
                return (
                  <tr key={b.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{b.id}</td>
                    <td className="px-4 py-3">
                      {customer && displayName(customer.name, customer.nameAr)}
                    </td>
                    <td className="px-4 py-3">
                      {categoryLabel(b.categoryId)}
                      <br />
                      <span className="text-xs text-navy-700/50">
                        {problemLabel(b.categoryId, b.problemId)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3">{formatSar(b.estimatedFeeSar)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/bookings/${b.id}`} className="font-semibold text-teal-600 hover:underline">
                        {t('viewDetails')}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function AdminBookingDetail() {
  const { id } = useParams()
  const { state, actions } = useStore()
  const { t, categoryLabel, problemLabel, formatSar, displayName, statusLabel } = useI18n()
  const booking = state.bookings.find((b) => b.id === id)
  const customer = state.users.find((u) => u.id === booking?.customerId)
  const techs = state.users.filter(
    (u) =>
      u.role === 'technician' &&
      (u.active ?? true) &&
      (!booking || u.specialties?.includes(booking.categoryId)),
  )
  const [techId, setTechId] = useState('')
  const [quoteLines, setQuoteLines] = useState({ label: '', amount: '' })

  if (!booking) {
    return <EmptyState title={t('noData')} />
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{booking.id}</h1>
          <p className="text-sm text-navy-700/55">
            {categoryLabel(booking.categoryId)} · {problemLabel(booking.categoryId, booking.problemId)}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="card-surface p-5 space-y-2 text-sm">
        <p>
          <span className="text-navy-700/50">{t('customerInfo')}: </span>
          {customer && displayName(customer.name, customer.nameAr)} ({customer?.phone})
        </p>
        <p>
          <span className="text-navy-700/50">{t('description')}: </span>
          {booking.description}
        </p>
        <p>
          <span className="text-navy-700/50">{t('address')}: </span>
          {booking.address.street}
        </p>
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-3 font-semibold">{t('assignTechnician')}</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="input-field max-w-xs"
            value={techId || booking.technicianId || ''}
            onChange={(e) => setTechId(e.target.value)}
          >
            <option value="">—</option>
            {techs.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {displayName(tech.name, tech.nameAr)} ★{tech.rating}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary"
            disabled={!techId && !booking.technicianId}
            onClick={() =>
              void actions.assignTechnician(booking.id, techId || booking.technicianId!)
            }
          >
            {booking.technicianId ? t('reassign') : t('assignTechnician')}
          </button>
          {booking.status === 'new_request' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void actions.updateBookingStatus(booking.id, 'confirmed')}
            >
              {t('confirm')}
            </button>
          )}
        </div>
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-3 font-semibold">{t('history')}</h2>
        <ul className="space-y-2 text-sm">
          {booking.statusHistory.map((h) => (
            <li key={`${h.status}-${h.at}`} className="flex justify-between gap-4">
              <span>{statusLabel(h.status)}</span>
              <span className="text-navy-700/45">{new Date(h.at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-3 font-semibold">{t('sendQuotation')}</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="input-field"
            placeholder={t('label')}
            value={quoteLines.label}
            onChange={(e) => setQuoteLines({ ...quoteLines, label: e.target.value })}
          />
          <input
            className="input-field max-w-[140px]"
            type="number"
            placeholder={t('amount')}
            value={quoteLines.amount}
            onChange={(e) => setQuoteLines({ ...quoteLines, amount: e.target.value })}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (!quoteLines.label || !quoteLines.amount) return
              const lines: CostLine[] = [
                ...booking.costs,
                {
                  id: `ql-${Date.now()}`,
                  label: quoteLines.label,
                  amountSar: Number(quoteLines.amount),
                  type: 'materials',
                },
              ]
              void actions.createQuotation(booking.id, lines)
              setQuoteLines({ label: '', amount: '' })
            }}
          >
            {t('sendQuotation')}
          </button>
        </div>
        <p className="mt-2 text-sm text-navy-700/55">
          {t('total')}: {formatSar(booking.costs.reduce((s, c) => s + c.amountSar, 0))}
        </p>
      </div>

      {booking.process?.currentStepNote && (
        <div className="card-surface p-5">
          <h2 className="mb-2 font-semibold">{t('trackStatus')}</h2>
          <p className="text-sm text-teal-700">{booking.process.currentStepNote}</p>
          {booking.process.workChecklist?.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-navy-700/70">
              {booking.process.workChecklist.map((c) => (
                <li key={c.id}>
                  {c.done ? '✓' : '○'} {c.label}
                </li>
              ))}
            </ul>
          )}
          {booking.process.technicianNotes?.length > 0 && (
            <div className="mt-4 space-y-2">
              {[...booking.process.technicianNotes].reverse().map((n) => (
                <p key={n.id} className="rounded-lg bg-sand-50 px-3 py-2 text-sm">
                  {n.text}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <Link to="/admin/bookings" className="btn-secondary">
        {t('back')}
      </Link>
    </div>
  )
}
