import { Camera, Check, ChevronLeft, ChevronRight, Droplets, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mapsService } from '../../adapters'
import { LAUNCH_CITY_ID, serviceAreaCities } from '../../config/cities'
import { SERVICE_CATEGORIES, type ServiceCategoryId } from '../../config/services'
import { useI18n } from '../../i18n'
import { useStore } from '../../store/store'
import { TIME_SLOTS, type JobPhoto } from '../../store/types'

const steps = [
  'selectService',
  'selectProblem',
  'describeProblem',
  'enterLocation',
  'choosePartner',
  'selectDateTime',
  'reviewSubmit',
] as const

export function BookService() {
  const { t, locale, formatSar, categoryLabel, problemLabel, displayName } = useI18n()
  const { actions, currentUser, state } = useStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [categoryId, setCategoryId] = useState<ServiceCategoryId | null>(null)
  const [problemId, setProblemId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const cities = serviceAreaCities()
  const launch = cities.find((c) => c.id === LAUNCH_CITY_ID) ?? cities[0]
  const [cityId, setCityId] = useState(currentUser?.cityId ?? launch.id)
  const [districtId, setDistrictId] = useState(
    currentUser?.districtId ?? launch.districts[0]?.id ?? '',
  )
  const [street, setStreet] = useState('')
  const [building, setBuilding] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [preferredTimeSlot, setPreferredTimeSlot] = useState('10-12')
  const [discountCode, setDiscountCode] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState(0)
  const [preferredOrganizationId, setPreferredOrganizationId] = useState<string | 'auto'>('auto')

  const partners = state.organizations.filter(
    (o) =>
      o.status === 'active' &&
      (o.kind === 'company' || o.kind === 'independent') &&
      (o.serviceCityIds?.includes(cityId) || o.cityId === cityId || !o.serviceCityIds?.length),
  )

  const category = SERVICE_CATEGORIES.find((c) => c.id === categoryId)
  const districts = useMemo(
    () => cities.find((c) => c.id === cityId)?.districts ?? [],
    [cities, cityId],
  )

  const baseFee = categoryId && problemId ? actions.getEffectiveFee(categoryId, problemId) : 0
  const estimatedFee = Math.max(0, baseFee - appliedDiscount)

  const canNext = () => {
    if (step === 0) return !!categoryId
    if (step === 1) return !!problemId
    if (step === 2) return description.trim().length >= 10
    if (step === 3) return street.trim().length >= 3
    if (step === 4) return !!preferredOrganizationId
    if (step === 5) return !!preferredDate && !!preferredTimeSlot
    return true
  }

  const onPhotos = async (files: FileList | null) => {
    if (!files) return
    const next: JobPhoto[] = []
    for (const file of Array.from(files).slice(0, 4)) {
      const dataUrl = await readFile(file)
      next.push({
        id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        kind: 'issue',
        dataUrl,
        uploadedAt: new Date().toISOString(),
      })
    }
    setPhotos((p) => [...p, ...next].slice(0, 6))
  }

  const applyDiscount = () => {
    if (!discountCode.trim() || !baseFee) {
      setAppliedDiscount(0)
      return
    }
    // Preview only — actual apply happens on submit via store
    const codes: Record<string, number> = { WELCOME20: 20, RAMADAN15: 15 }
    const pct = codes[discountCode.trim().toUpperCase()]
    setAppliedDiscount(pct ? Math.round((baseFee * pct) / 100) : 0)
  }

  const submit = async () => {
    if (!categoryId || !problemId) return
    const geo = await mapsService.geocode(`${street} ${cityId}`)
    const booking = await actions.createBooking({
      categoryId,
      problemId,
      description,
      photos,
      address: {
        cityId,
        districtId,
        street,
        building,
        lat: geo.lat,
        lng: geo.lng,
      },
      preferredDate,
      preferredTimeSlot,
      discountCode: discountCode || undefined,
      preferredOrganizationId:
        preferredOrganizationId === 'auto' ? undefined : preferredOrganizationId,
    })
    navigate(`/app/bookings/${booking.id}`)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold text-navy-900">{t('bookService')}</h1>
      <p className="mb-6 text-sm text-navy-700/55">
        {t(steps[step])} · {step + 1}/{steps.length}
      </p>

      <div className="mb-6 flex gap-1.5">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${
              i <= step ? 'bg-teal-500' : 'bg-navy-100'
            }`}
          />
        ))}
      </div>

      <div className="card-surface p-5 sm:p-6 animate-fade-in">
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {SERVICE_CATEGORIES.map((cat) => {
              const Icon = cat.icon === 'droplets' ? Droplets : Zap
              const selected = categoryId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(cat.id)
                    setProblemId(null)
                  }}
                  className={`rounded-2xl border p-5 text-start transition ${
                    selected
                      ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20'
                      : 'border-navy-100 hover:border-teal-300'
                  }`}
                >
                  <Icon className={`mb-3 h-7 w-7 ${selected ? 'text-teal-600' : 'text-navy-700'}`} />
                  <p className="font-bold text-navy-900">
                    {locale === 'ar' ? cat.labelAr : cat.labelEn}
                  </p>
                  <p className="mt-1 text-xs text-navy-700/55">
                    {locale === 'ar' ? cat.descriptionAr : cat.descriptionEn}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        {step === 1 && category && (
          <div className="grid gap-2">
            {category.problems.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProblemId(p.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-start transition ${
                  problemId === p.id
                    ? 'border-teal-500 bg-teal-50/50'
                    : 'border-navy-100 hover:border-teal-300'
                }`}
              >
                <span className="font-medium text-navy-900">
                  {locale === 'ar' ? p.labelAr : p.labelEn}
                </span>
                <span className="text-sm text-navy-700/60">
                  {formatSar(actions.getEffectiveFee(category.id, p.id))}
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="label-text">{t('describeProblem')}</label>
              <textarea
                className="input-field min-h-28 resize-y"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="..."
              />
            </div>
            <div>
              <label className="label-text">{t('uploadPhotos')}</label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-navy-100 bg-sand-50/50 px-4 py-8 text-sm text-navy-700/60 hover:border-teal-400">
                <Camera className="h-6 w-6 text-teal-500" />
                {t('uploadPhotos')}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void onPhotos(e.target.files)}
                />
              </label>
              {photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <img
                      key={p.id}
                      src={p.dataUrl}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-text">{t('city')}</label>
                <select
                  className="input-field"
                  value={cityId}
                  onChange={(e) => {
                    const city = cities.find((c) => c.id === e.target.value)!
                    setCityId(city.id)
                    setDistrictId(city.districts[0]?.id ?? '')
                  }}
                >
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {locale === 'ar' ? c.nameAr : c.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-text">{t('district')}</label>
                <select
                  className="input-field"
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                >
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {locale === 'ar' ? d.nameAr : d.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label-text">{t('street')}</label>
              <input
                className="input-field"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label-text">
                {t('buildingNotes')} ({t('optional')})
              </label>
              <input
                className="input-field"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-navy-700/65">{t('limitedCompetition')}</p>
            <button
              type="button"
              onClick={() => setPreferredOrganizationId('auto')}
              className={`w-full rounded-xl border px-4 py-3 text-start transition ${
                preferredOrganizationId === 'auto'
                  ? 'border-teal-500 bg-teal-50/50'
                  : 'border-navy-100 hover:border-teal-300'
              }`}
            >
              <p className="font-semibold text-navy-900">{t('matchAuto')}</p>
              <p className="mt-1 text-xs text-navy-700/55">{t('seePartners')}</p>
            </button>
            <div className="grid gap-2">
              {partners.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreferredOrganizationId(p.id)}
                  className={`rounded-xl border px-4 py-3 text-start transition ${
                    preferredOrganizationId === p.id
                      ? 'border-teal-500 bg-teal-50/50'
                      : 'border-navy-100 hover:border-teal-300'
                  }`}
                >
                  <p className="font-semibold text-navy-900">
                    {displayName(p.name, p.nameAr)}
                  </p>
                  <p className="mt-1 text-xs text-navy-700/55">
                    {p.kind === 'company' ? t('maintenanceCompany') : t('independentTech')}
                    {p.foundingPartner ? ` · ${t('foundingPartners')}` : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div>
              <label className="label-text">{t('date')}</label>
              <input
                type="date"
                className="input-field"
                value={preferredDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setPreferredDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label-text">{t('time')}</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setPreferredTimeSlot(slot.id)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      preferredTimeSlot === slot.id
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-navy-100 text-navy-800'
                    }`}
                  >
                    {locale === 'ar' ? slot.labelAr : slot.labelEn}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-teal-50/60 p-4">
              <p className="text-sm text-navy-700/60">{t('estimatedFee')}</p>
              <p className="text-2xl font-bold text-navy-900">{formatSar(baseFee)}</p>
            </div>
          </div>
        )}

        {step === 6 && categoryId && problemId && (
          <div className="space-y-4">
            <dl className="space-y-3 text-sm">
              <Row label={t('category')} value={categoryLabel(categoryId)} />
              <Row label={t('problem')} value={problemLabel(categoryId, problemId)} />
              <Row label={t('description')} value={description} />
              <Row
                label={t('partnerCompany')}
                value={
                  preferredOrganizationId === 'auto'
                    ? t('matchAuto')
                    : displayName(
                        partners.find((p) => p.id === preferredOrganizationId)?.name ?? '',
                        partners.find((p) => p.id === preferredOrganizationId)?.nameAr ?? '',
                      )
                }
              />
              <Row label={t('date')} value={preferredDate} />
              <Row
                label={t('address')}
                value={`${street}, ${districts.find((d) => d.id === districtId)?.[locale === 'ar' ? 'nameAr' : 'nameEn']}`}
              />
            </dl>
            <div className="flex gap-2">
              <input
                className="input-field"
                placeholder={t('discountCode')}
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
              />
              <button type="button" className="btn-secondary shrink-0" onClick={applyDiscount}>
                {t('apply')}
              </button>
            </div>
            <div className="rounded-xl border border-navy-100 bg-sand-50/80 p-4">
              <div className="flex justify-between text-sm">
                <span>{t('estimatedFee')}</span>
                <span className="font-bold">{formatSar(estimatedFee)}</span>
              </div>
              {appliedDiscount > 0 && (
                <p className="mt-1 text-xs text-teal-600">−{formatSar(appliedDiscount)}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          {t('back')}
        </button>
        {step < steps.length - 1 ? (
          <button
            type="button"
            className="btn-primary"
            disabled={!canNext()}
            onClick={() => setStep((s) => s + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={() => void submit()}>
            <Check className="h-4 w-4" />
            {t('finish')}
          </button>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-navy-50 pb-2">
      <dt className="text-navy-700/55">{label}</dt>
      <dd className="max-w-[60%] text-end font-medium text-navy-900">{value}</dd>
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
