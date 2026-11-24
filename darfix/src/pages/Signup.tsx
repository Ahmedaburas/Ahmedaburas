import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SAUDI_CITIES } from '../config/cities'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Logo } from '../components/Logo'
import { useI18n } from '../i18n'
import { useStore } from '../store/store'

export function Signup() {
  const { t, locale } = useI18n()
  const { actions } = useStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    cityId: 'riyadh',
    districtId: 'olaya',
  })
  const [error, setError] = useState('')

  const districts = useMemo(
    () => SAUDI_CITIES.find((c) => c.id === form.cityId)?.districts ?? [],
    [form.cityId],
  )

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await actions.signup({
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      cityId: form.cityId,
      districtId: form.districtId,
    })
    if ('error' in result) {
      setError(result.error)
      return
    }
    navigate('/app')
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <LanguageSwitcher />
      </div>

      <div className="mx-auto max-w-lg px-4 pb-16">
        <h1 className="animate-fade-up text-3xl font-extrabold tracking-tight text-navy-900">
          {t('createAccount')}
        </h1>
        <p className="mt-2 text-navy-700/60">{t('tagline')}</p>

        <form onSubmit={onSubmit} className="card-surface mt-8 space-y-4 p-6 animate-fade-up stagger-1">
          <div>
            <label className="label-text">{t('name')}</label>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-text">{t('city')}</label>
              <select
                className="input-field"
                value={form.cityId}
                onChange={(e) => {
                  const city = SAUDI_CITIES.find((c) => c.id === e.target.value)!
                  setForm({
                    ...form,
                    cityId: city.id,
                    districtId: city.districts[0]?.id ?? '',
                  })
                }}
              >
                {SAUDI_CITIES.map((c) => (
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
        </p>
      </div>
    </div>
  )
}
