import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Logo } from '../components/Logo'
import { useI18n } from '../i18n'
import { useStore } from '../store/store'

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

  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <LanguageSwitcher />
      </div>

      <div className="mx-auto grid w-full max-w-md flex-1 items-center px-4 pb-16">
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
      </div>
    </div>
  )
}
