import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Logo } from '../components/Logo'
import { useI18n } from '../i18n'
import { DEMO_PASSWORD, useStore } from '../store/store'

const demos = [
  { role: 'customer', email: 'customer@darfix.sa', labelKey: 'customer' },
  { role: 'technician', email: 'tech@darfix.sa', labelKey: 'independentTech' },
  { role: 'provider', email: 'company@darfix.sa', labelKey: 'maintenanceCompany' },
  { role: 'admin', email: 'admin@darfix.sa', labelKey: 'admin' },
] as const

export function Login() {
  const { t } = useI18n()
  const { actions } = useStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const goHome = (role: string) => {
    if (role === 'admin') navigate('/admin')
    else if (role === 'technician') navigate('/tech')
    else if (role === 'provider') navigate('/provider')
    else navigate('/app')
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const user = await actions.login(email.trim(), password)
    if (!user) {
      setError(t('loginFailed'))
      return
    }
    goHome(user.role)
  }

  const quickLogin = async (demoEmail: string) => {
    const user = await actions.login(demoEmail, DEMO_PASSWORD)
    if (user) goHome(user.role)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <LanguageSwitcher />
      </div>

      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 pb-16 lg:grid-cols-2">
        <div className="animate-fade-up">
          <h1 className="text-3xl font-extrabold tracking-tight text-navy-900">{t('welcomeBack')}</h1>
          <p className="mt-2 text-navy-700/60">{t('tagline')}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="label-text" htmlFor="email">
                {t('email')}
              </label>
              <input
                id="email"
                className="input-field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="label-text" htmlFor="password">
                {t('password')}
              </label>
              <input
                id="password"
                className="input-field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full py-3">
              {t('signIn')}
            </button>
          </form>

          <p className="mt-4 text-sm text-navy-700/60">
            {t('noAccount')}{' '}
            <Link to="/signup" className="font-semibold text-teal-600 hover:underline">
              {t('signUp')}
            </Link>
            {' · '}
            <Link to="/signup/provider" className="font-semibold text-teal-600 hover:underline">
              {t('joinAsProvider')}
            </Link>
          </p>
        </div>

        <div className="card-surface animate-fade-up stagger-2 p-6">
          <h2 className="font-bold text-navy-900">{t('demoAccounts')}</h2>
          <p className="mt-1 text-sm text-navy-700/60">
            {t('passwordHint')}: <code className="rounded bg-sand-100 px-1.5 py-0.5">{DEMO_PASSWORD}</code>
          </p>
          <div className="mt-5 space-y-3">
            {demos.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => void quickLogin(d.email)}
                className="flex w-full items-center justify-between rounded-xl border border-navy-100 bg-sand-50/50 px-4 py-3 text-start transition hover:border-teal-400 hover:bg-teal-50/40"
              >
                <div>
                  <p className="font-semibold text-navy-900">{t(d.labelKey)}</p>
                  <p className="text-xs text-navy-700/55">{d.email}</p>
                </div>
                <span className="text-xs font-semibold text-teal-600">{t('signIn')} →</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
