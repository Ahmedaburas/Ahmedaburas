import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { LAUNCH_CITY_ID, serviceAreaCities } from '../config/cities'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Logo } from '../components/Logo'
import { useI18n } from '../i18n'
import { useStore } from '../store/store'
import type { ServiceCategoryId } from '../config/services'

export function ProviderSignup() {
  const { t, locale } = useI18n()
  const { actions } = useStore()
  const navigate = useNavigate()
  const cities = serviceAreaCities()
  const launch = cities.find((c) => c.id === LAUNCH_CITY_ID) ?? cities[0]

  const [kind, setKind] = useState<'independent' | 'company'>('independent')
  const [inviteRequired, setInviteRequired] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    cityId: launch.id,
    districtId: launch.districts[0]?.id ?? '',
    companyName: '',
    commercialRegistration: '',
    licenseNumber: '',
    whatsapp: '',
    slaHours: '4',
    techCount: '3',
    priceApproverName: '',
    priceApproverPhone: '',
    inviteCode: '',
    plumbing: true,
    electrical: false,
    cityKhobar: true,
    cityDhahran: false,
    cityDammam: false,
    cityJubail: false,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    void api
      .providerSignupConfig()
      .then((c) => setInviteRequired(c.inviteRequired))
      .catch(() => setInviteRequired(false))
  }, [])

  const districts = useMemo(
    () => cities.find((c) => c.id === form.cityId)?.districts ?? [],
    [cities, form.cityId],
  )

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const specialties: ServiceCategoryId[] = []
    if (form.plumbing) specialties.push('plumbing')
    if (form.electrical) specialties.push('electrical')
    if (specialties.length === 0) {
      setError(t('selectService'))
      return
    }

    const serviceCityIds = [
      form.cityKhobar && 'khobar',
      form.cityDhahran && 'dhahran',
      form.cityDammam && 'dammam',
      form.cityJubail && 'jubail',
    ].filter(Boolean) as string[]
    if (serviceCityIds.length === 0) serviceCityIds.push(form.cityId)

    const result = await actions.signupProvider({
      kind,
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      cityId: form.cityId,
      districtId: form.districtId,
      specialties,
      companyName: kind === 'company' ? form.companyName : undefined,
      commercialRegistration: form.commercialRegistration || undefined,
      licenseNumber: form.licenseNumber || undefined,
      whatsapp: form.whatsapp || form.phone,
      slaHours: Number(form.slaHours) || undefined,
      techCount: Number(form.techCount) || undefined,
      serviceCityIds,
      priceApproverName: form.priceApproverName || undefined,
      priceApproverPhone: form.priceApproverPhone || undefined,
      inviteCode: form.inviteCode.trim() || undefined,
    })
    if ('error' in result) {
      setError(result.error)
      return
    }
    navigate(result.role === 'provider' ? '/provider' : '/tech')
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <LanguageSwitcher />
      </div>

      <div className="mx-auto max-w-lg px-4 pb-16">
        <h1 className="animate-fade-up text-3xl font-extrabold tracking-tight text-navy-900">
          {t('joinAsProvider')}
        </h1>
        <p className="mt-2 text-navy-700/60">{t('providerSignupSub')}</p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
              kind === 'independent'
                ? 'border-teal-500 bg-teal-50 text-teal-800'
                : 'border-navy-100 text-navy-700/70'
            }`}
            onClick={() => setKind('independent')}
          >
            {t('independentTech')}
          </button>
          <button
            type="button"
            className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
              kind === 'company'
                ? 'border-teal-500 bg-teal-50 text-teal-800'
                : 'border-navy-100 text-navy-700/70'
            }`}
            onClick={() => setKind('company')}
          >
            {t('maintenanceCompany')}
          </button>
        </div>

        <form onSubmit={onSubmit} className="card-surface mt-6 space-y-4 p-6 animate-fade-up stagger-1">
          {kind === 'company' && (
            <div>
              <label className="label-text">{t('companyName')}</label>
              <input
                className="input-field"
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </div>
          )}
          <div>
            <label className="label-text">{kind === 'company' ? t('ownerName') : t('name')}</label>
            <input
              className="input-field"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label-text">{t('email')}</label>
            <input
              className="input-field"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label-text">{t('phone')}</label>
            <input
              className="input-field"
              placeholder="05XXXXXXXX"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label-text">{t('password')}</label>
            <input
              className="input-field"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="label-text">{t('inviteCode')}</label>
            <input
              className="input-field"
              value={form.inviteCode}
              required={inviteRequired}
              autoComplete="off"
              onChange={(e) => setForm({ ...form, inviteCode: e.target.value })}
            />
            <p className="mt-1 text-xs text-navy-700/50">
              {inviteRequired ? t('inviteCodeRequired') : t('inviteCodeOptional')}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-text">{t('city')}</label>
              <select
                className="input-field"
                value={form.cityId}
                onChange={(e) => {
                  const city = cities.find((c) => c.id === e.target.value)!
                  setForm({
                    ...form,
                    cityId: city.id,
                    districtId: city.districts[0]?.id ?? '',
                  })
                }}
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {locale === 'ar' ? c.nameAr : c.nameEn}
                    {c.tier === 'launch' ? ` · ${t('launchMarket')}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">{t('district')}</label>
              <select
                className="input-field"
                value={form.districtId}
                onChange={(e) => setForm({ ...form, districtId: e.target.value })}
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
            <p className="label-text mb-2">{t('specialties')}</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.plumbing}
                  onChange={(e) => setForm({ ...form, plumbing: e.target.checked })}
                />
                {t('plumbing')}
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.electrical}
                  onChange={(e) => setForm({ ...form, electrical: e.target.checked })}
                />
                {t('electrical')}
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-navy-100 bg-sand-50/80 p-4">
            <p className="text-sm font-semibold text-navy-900">{t('capacitySurvey')}</p>
            <p className="mt-1 text-xs text-navy-700/55">{t('orgRolesHint')}</p>
            <div className="mt-3">
              <p className="label-text mb-2">{t('serviceCities')}</p>
              <div className="flex flex-wrap gap-3 text-sm">
                {(
                  [
                    ['cityKhobar', 'Khobar'],
                    ['cityDhahran', 'Dhahran'],
                    ['cityDammam', 'Dammam'],
                    ['cityJubail', 'Jubail'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label-text">{t('whatsappBusiness')}</label>
                <input
                  className="input-field"
                  placeholder="05XXXXXXXX"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                />
              </div>
              <div>
                <label className="label-text">{t('slaHours')}</label>
                <input
                  className="input-field"
                  type="number"
                  min={1}
                  max={48}
                  value={form.slaHours}
                  onChange={(e) => setForm({ ...form, slaHours: e.target.value })}
                />
              </div>
              {kind === 'company' && (
                <>
                  <div>
                    <label className="label-text">{t('techHeadcount')}</label>
                    <input
                      className="input-field"
                      type="number"
                      min={1}
                      value={form.techCount}
                      onChange={(e) => setForm({ ...form, techCount: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label-text">{t('priceApprover')}</label>
                    <input
                      className="input-field"
                      value={form.priceApproverName}
                      onChange={(e) => setForm({ ...form, priceApproverName: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {kind === 'company' && (
              <div>
                <label className="label-text">{t('commercialRegistration')}</label>
                <input
                  className="input-field"
                  placeholder="2055…"
                  value={form.commercialRegistration}
                  onChange={(e) => setForm({ ...form, commercialRegistration: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="label-text">{t('licenseNumber')}</label>
              <input
                className="input-field"
                value={form.licenseNumber}
                onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
              />
            </div>
          </div>

          <p className="text-xs text-navy-700/50">{t('kycNote')}</p>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full py-3">
            {t('signUp')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-navy-700/60">
          {t('alreadyHaveAccount')}{' '}
          <Link to="/login" className="font-semibold text-teal-600 hover:underline">
            {t('signIn')}
          </Link>
          {' · '}
          <Link to="/signup" className="font-semibold text-teal-600 hover:underline">
            {t('customer')}
          </Link>
        </p>
      </div>
    </div>
  )
}
