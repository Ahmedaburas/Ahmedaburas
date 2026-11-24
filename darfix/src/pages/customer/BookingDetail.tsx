import { Phone, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { mapsService } from '../../adapters'
import { ProcessTracker } from '../../components/ProcessTracker'
import { StatusBadge } from '../../components/StatusBadge'
import { useI18n } from '../../i18n'
import { useStore } from '../../store/store'

export function CustomerBookingDetail() {
  const { id } = useParams()
  const { state, actions } = useStore()
  const {
    t,
    locale,
    categoryLabel,
    problemLabel,
    cityLabel,
    districtLabel,
    timeSlotLabel,
    formatSar,
    displayName,
  } = useI18n()

  const booking = state.bookings.find((b) => b.id === id)
  const tech = state.users.find((u) => u.id === booking?.technicianId)
  const invoice = state.invoices.find((i) => i.bookingId === id)
  const [rating, setRating] = useState(5)
  const [review, setReview] = useState('')
  const [paying, setPaying] = useState(false)
  const [busy, setBusy] = useState(false)

  const mapUrl = useMemo(() => {
    if (!booking?.address.lat) return null
    return mapsService.staticMapUrl({
      lat: booking.address.lat,
      lng: booking.address.lng!,
      label: booking.address.street,
    })
  }, [booking])

  if (!booking) {
    return (
      <div className="card-surface p-8 text-center">
        <p>{t('noData')}</p>
        <Link to="/app" className="btn-primary mt-4">
          {t('home')}
        </Link>
      </div>
    )
  }

  const pendingExtra = booking.extraWork.filter((e) => e.status === 'pending')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-navy-700/45">
            {categoryLabel(booking.categoryId)}
          </p>
          <h1 className="text-2xl font-bold text-navy-900">
            {problemLabel(booking.categoryId, booking.problemId)}
          </h1>
          <p className="mt-1 text-sm text-navy-700/50">{booking.id}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <ProcessTracker booking={booking} />

      {pendingExtra.length > 0 && (
        <div className="card-surface border-orange-200 bg-orange-50/40 p-5">
          <h2 className="mb-3 font-semibold text-navy-900">{t('awaitingApproval')}</h2>
          {pendingExtra.map((e) => (
            <div key={e.id} className="mb-3 rounded-xl bg-white p-4">
              <p className="text-sm text-navy-800">{e.description}</p>
              <p className="mt-1 font-semibold text-navy-900">{formatSar(e.amountSar)}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    await actions.respondExtraWork(booking.id, e.id, true)
                    setBusy(false)
                  }}
                >
                  {t('approve')}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    await actions.respondExtraWork(booking.id, e.id, false)
                    setBusy(false)
                  }}
                >
                  {t('reject')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tech && (
        <div className="card-surface p-5">
          <h2 className="mb-3 font-semibold text-navy-900">{t('technicianDetails')}</h2>
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ background: tech.avatarColor }}
            >
              {displayName(tech.name, tech.nameAr).charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-navy-900">
                {displayName(tech.name, tech.nameAr)}
              </p>
              <p className="text-sm text-navy-700/55">
                ★ {tech.rating?.toFixed(1)} · {tech.reviewCount} {t('reviews').toLowerCase()}
              </p>
              {booking.status === 'on_the_way' && booking.process?.estimatedArrival && (
                <p className="mt-1 text-xs font-medium text-teal-700">
                  ETA{' '}
                  {new Date(booking.process.estimatedArrival).toLocaleTimeString(
                    locale === 'ar' ? 'ar-SA' : 'en-SA',
                    { hour: '2-digit', minute: '2-digit' },
                  )}
                </p>
              )}
            </div>
            <a href={`tel:${tech.phone}`} className="btn-secondary">
              <Phone className="h-4 w-4" />
              {t('call')}
            </a>
          </div>
        </div>
      )}

      <div className="card-surface p-5">
        <h2 className="mb-3 font-semibold text-navy-900">{t('description')}</h2>
        <p className="text-sm leading-relaxed text-navy-800">{booking.description}</p>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-navy-700/50">{t('date')}: </span>
            {booking.preferredDate} · {timeSlotLabel(booking.preferredTimeSlot)}
          </p>
          <p>
            <span className="text-navy-700/50">{t('location')}: </span>
            {districtLabel(booking.address.cityId, booking.address.districtId)},{' '}
            {cityLabel(booking.address.cityId)}
          </p>
          <p className="sm:col-span-2">
            <span className="text-navy-700/50">{t('address')}: </span>
            {booking.address.street}
          </p>
        </div>
        {mapUrl && (
          <img src={mapUrl} alt={t('mapPreview')} className="mt-4 w-full rounded-xl" />
        )}
        {booking.photos.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {booking.photos.map((p) => (
              <img key={p.id} src={p.dataUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
            ))}
          </div>
        )}
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-3 font-semibold text-navy-900">{t('costs')}</h2>
        <ul className="space-y-2 text-sm">
          {booking.costs.map((c) => (
            <li key={c.id} className="flex justify-between">
              <span className="text-navy-700/70">{c.label}</span>
              <span className="font-medium">{formatSar(c.amountSar)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-navy-100 pt-3 font-bold">
          <span>{t('total')}</span>
          <span>{formatSar(booking.costs.reduce((s, c) => s + c.amountSar, 0))}</span>
        </div>
      </div>

      {invoice && (
        <div className="card-surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-navy-900">{t('invoice')}</h2>
              <p className="text-sm text-navy-700/55">
                {invoice.id} · {invoice.status === 'paid' ? t('paid') : t('unpaid')}
              </p>
            </div>
            {invoice.status === 'unpaid' && (
              <button
                type="button"
                className="btn-primary"
                disabled={paying}
                onClick={async () => {
                  setPaying(true)
                  await actions.payInvoice(invoice.id)
                  setPaying(false)
                }}
              >
                {t('payNow')} · {formatSar(invoice.totalSar)}
              </button>
            )}
          </div>
        </div>
      )}

      {booking.status === 'completed' && !booking.rating && (
        <div className="card-surface p-5">
          <h2 className="mb-3 font-semibold text-navy-900">{t('rateReview')}</h2>
          <div className="mb-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)}>
                <Star
                  className={`h-7 w-7 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-navy-200'}`}
                />
              </button>
            ))}
          </div>
          <textarea
            className="input-field min-h-24"
            placeholder={t('writeReview')}
            value={review}
            onChange={(e) => setReview(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary mt-3"
            onClick={() => void actions.rateBooking(booking.id, rating, review)}
          >
            {t('submitReview')}
          </button>
        </div>
      )}

      {booking.rating && (
        <div className="card-surface p-5">
          <h2 className="mb-2 font-semibold text-navy-900">{t('reviews')}</h2>
          <p className="text-amber-500">{'★'.repeat(booking.rating)}</p>
          <p className="mt-2 text-sm text-navy-800">{booking.reviewText}</p>
        </div>
      )}

      {booking.status !== 'completed' && booking.status !== 'cancelled' && (
        <button
          type="button"
          className="btn-secondary text-red-600"
          onClick={() => void actions.cancelBooking(booking.id)}
        >
          {t('cancel')}
        </button>
      )}
    </div>
  )
}
