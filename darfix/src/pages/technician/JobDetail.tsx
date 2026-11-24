import { Camera, MapPin, Phone } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { mapsService } from '../../adapters'
import { StatusBadge } from '../../components/StatusBadge'
import { useI18n } from '../../i18n'
import { useStore } from '../../store/store'
import type { BookingStatus, CostLine, JobPhoto } from '../../store/types'

const TECH_STATUSES: BookingStatus[] = [
  'on_the_way',
  'arrived',
  'in_progress',
  'completed',
]

export function TechJobDetail() {
  const { id } = useParams()
  const { state, actions } = useStore()
  const {
    t,
    categoryLabel,
    problemLabel,
    cityLabel,
    districtLabel,
    formatSar,
    displayName,
  } = useI18n()

  const booking = state.bookings.find((b) => b.id === id)
  const customer = state.users.find((u) => u.id === booking?.customerId)

  const [costLabel, setCostLabel] = useState('')
  const [costAmount, setCostAmount] = useState('')
  const [costType, setCostType] = useState<'labor' | 'materials'>('materials')
  const [extraDesc, setExtraDesc] = useState('')
  const [extraAmount, setExtraAmount] = useState('')
  const [report, setReport] = useState(booking?.jobReport ?? '')

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
        <Link to="/tech" className="btn-primary mt-4">
          {t('home')}
        </Link>
      </div>
    )
  }

  const addPhoto = async (kind: JobPhoto['kind'], files: FileList | null) => {
    if (!files?.[0]) return
    const dataUrl = await readFile(files[0])
    actions.addBookingPhotos(booking.id, [
      {
        id: `ph-${Date.now()}`,
        kind,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      },
    ])
  }

  const addCost = () => {
    const amount = Number(costAmount)
    if (!costLabel || !amount) return
    const line: CostLine = {
      id: `cost-${Date.now()}`,
      label: costLabel,
      amountSar: amount,
      type: costType,
    }
    actions.addCosts(booking.id, [line])
    setCostLabel('')
    setCostAmount('')
  }

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
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {customer && (
        <div className="card-surface p-5">
          <h2 className="mb-3 font-semibold text-navy-900">{t('customerInfo')}</h2>
          <p className="font-medium">{displayName(customer.name, customer.nameAr)}</p>
          <p className="text-sm text-navy-700/60">{customer.phone}</p>
          <p className="mt-2 flex items-start gap-2 text-sm text-navy-800">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
            {booking.address.street} —{' '}
            {districtLabel(booking.address.cityId, booking.address.districtId)},{' '}
            {cityLabel(booking.address.cityId)}
          </p>
          <a href={`tel:${customer.phone}`} className="btn-secondary mt-3">
            <Phone className="h-4 w-4" />
            {t('call')}
          </a>
          {mapUrl && <img src={mapUrl} alt="" className="mt-4 w-full rounded-xl" />}
        </div>
      )}

      <div className="card-surface p-5">
        <h2 className="mb-2 font-semibold text-navy-900">{t('description')}</h2>
        <p className="text-sm text-navy-800">{booking.description}</p>
        {booking.photos.filter((p) => p.kind === 'issue').length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {booking.photos
              .filter((p) => p.kind === 'issue')
              .map((p) => (
                <img key={p.id} src={p.dataUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
              ))}
          </div>
        )}
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-3 font-semibold text-navy-900">{t('updateStatus')}</h2>
        <div className="flex flex-wrap gap-2">
          {TECH_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`btn-secondary ${booking.status === s ? 'border-teal-500 bg-teal-50' : ''}`}
              onClick={() => {
                if (s === 'completed') return
                actions.updateBookingStatus(booking.id, s)
              }}
              disabled={s === 'completed'}
            >
              {s === 'on_the_way'
                ? t('onTheWay')
                : s === 'arrived'
                  ? t('arrived')
                  : s === 'in_progress'
                    ? t('inProgress')
                    : t('completed')}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-navy-700/45">
          {t('completed')} → {t('submitReport')}
        </p>
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-3 font-semibold text-navy-900">{t('beforeAfter')}</h2>
        <div className="flex flex-wrap gap-3">
          {(['before', 'after'] as const).map((kind) => (
            <label
              key={kind}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-navy-100 px-6 py-4 text-sm hover:border-teal-400"
            >
              <Camera className="h-5 w-5 text-teal-500" />
              {t(kind)}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void addPhoto(kind, e.target.files)}
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {booking.photos
            .filter((p) => p.kind === 'before' || p.kind === 'after')
            .map((p) => (
              <div key={p.id} className="relative">
                <img src={p.dataUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
                <span className="absolute bottom-1 start-1 rounded bg-navy-900/70 px-1 text-[10px] text-white">
                  {t(p.kind)}
                </span>
              </div>
            ))}
        </div>
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-3 font-semibold text-navy-900">{t('materialsLabor')}</h2>
        <ul className="mb-4 space-y-1 text-sm">
          {booking.costs.map((c) => (
            <li key={c.id} className="flex justify-between">
              <span>{c.label}</span>
              <span>{formatSar(c.amountSar)}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-4">
          <input
            className="input-field sm:col-span-2"
            placeholder={t('label')}
            value={costLabel}
            onChange={(e) => setCostLabel(e.target.value)}
          />
          <input
            className="input-field"
            type="number"
            placeholder={t('amount')}
            value={costAmount}
            onChange={(e) => setCostAmount(e.target.value)}
          />
          <select
            className="input-field"
            value={costType}
            onChange={(e) => setCostType(e.target.value as 'labor' | 'materials')}
          >
            <option value="materials">{t('materials')}</option>
            <option value="labor">{t('labor')}</option>
          </select>
        </div>
        <button type="button" className="btn-secondary mt-3" onClick={addCost}>
          {t('addCost')}
        </button>
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-3 font-semibold text-navy-900">{t('extraWork')}</h2>
        <textarea
          className="input-field min-h-20"
          placeholder={t('description')}
          value={extraDesc}
          onChange={(e) => setExtraDesc(e.target.value)}
        />
        <input
          className="input-field mt-2"
          type="number"
          placeholder={t('amount')}
          value={extraAmount}
          onChange={(e) => setExtraAmount(e.target.value)}
        />
        <button
          type="button"
          className="btn-secondary mt-3"
          onClick={() => {
            if (!extraDesc || !extraAmount) return
            actions.requestExtraWork(booking.id, extraDesc, Number(extraAmount))
            setExtraDesc('')
            setExtraAmount('')
          }}
        >
          {t('submit')}
        </button>
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-3 font-semibold text-navy-900">{t('jobReport')}</h2>
        <textarea
          className="input-field min-h-28"
          value={report}
          onChange={(e) => setReport(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary mt-3"
          disabled={!report.trim() || booking.status === 'completed'}
          onClick={() => actions.submitJobReport(booking.id, report)}
        >
          {t('submitReport')}
        </button>
      </div>
    </div>
  )
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
