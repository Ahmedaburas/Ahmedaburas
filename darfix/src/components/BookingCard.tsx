import { Calendar, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import type { Booking } from '../store/types'
import { StatusBadge } from './StatusBadge'

export function BookingCard({ booking, to }: { booking: Booking; to: string }) {
  const { t, categoryLabel, problemLabel, cityLabel, districtLabel, formatSar, timeSlotLabel } =
    useI18n()

  return (
    <Link
      to={to}
      className="card-surface block p-4 transition hover:border-teal-400/50 hover:shadow-md animate-fade-up"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-navy-700/50">
            {categoryLabel(booking.categoryId)}
          </p>
          <h3 className="mt-0.5 font-semibold text-navy-900">
            {problemLabel(booking.categoryId, booking.problemId)}
          </h3>
          <p className="mt-1 text-xs text-navy-700/50">{booking.id}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-navy-700/70">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {booking.preferredDate} · {timeSlotLabel(booking.preferredTimeSlot)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {districtLabel(booking.address.cityId, booking.address.districtId)},{' '}
          {cityLabel(booking.address.cityId)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-navy-100 pt-3 text-sm">
        <span className="text-navy-700/60">{t('estimated')}</span>
        <span className="font-semibold text-navy-900">{formatSar(booking.estimatedFeeSar)}</span>
      </div>
    </Link>
  )
}
