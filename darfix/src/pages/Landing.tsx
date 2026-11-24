import { ArrowRight, Droplets, ShieldCheck, Languages, Wallet, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Logo } from '../components/Logo'
import { useI18n } from '../i18n'
import { useStore } from '../store/store'

export function Landing() {
  const { t } = useI18n()
  const { currentUser } = useStore()

  const dash =
    currentUser?.role === 'admin'
      ? '/admin'
      : currentUser?.role === 'technician'
        ? '/tech'
        : '/app'

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -end-24 -top-24 h-[420px] w-[420px] rounded-full bg-teal-400/10 blur-3xl" />
        <div className="absolute -start-20 bottom-0 h-[360px] w-[360px] rounded-full bg-navy-900/5 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%230B3A4A\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:py-5">
        <Logo />
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <LanguageSwitcher compact />
          {currentUser ? (
            <Link to={dash} className="btn-primary px-3 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm">
              {t('dashboard')}
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn-secondary hidden sm:inline-flex">
                {t('signIn')}
              </Link>
              <Link to="/signup" className="btn-primary px-3 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm">
                {t('getStarted')}
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 lg:grid-cols-2 lg:pt-16">
        <div className="animate-fade-up">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">
            {t('brand')}
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-navy-900 sm:text-5xl lg:text-[3.25rem]">
            {t('heroTitle')}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-navy-700/70 sm:text-lg">
            {t('heroSub')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={currentUser ? dash : '/signup'} className="btn-primary px-6 py-3">
              {t('getStarted')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
            <Link to="/login" className="btn-secondary px-6 py-3">
              {t('signIn')}
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-6 text-sm text-navy-700/70">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-500" />
              {t('trustedPros')}
            </span>
            <span className="inline-flex items-center gap-2">
              <Wallet className="h-4 w-4 text-teal-500" />
              {t('sarPricing')}
            </span>
            <span className="inline-flex items-center gap-2">
              <Languages className="h-4 w-4 text-teal-500" />
              {t('bilingual')}
            </span>
          </div>
        </div>

        <div className="relative animate-fade-up stagger-2">
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-navy-900 to-navy-700" />
          <div className="relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between text-white/80">
              <span className="text-sm font-medium">{t('howItWorks')}</span>
              <span className="rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-300">
                KSA
              </span>
            </div>
            <div className="space-y-4">
              {[
                { icon: Droplets, label: t('step1'), color: 'text-teal-300' },
                { icon: Zap, label: t('step2'), color: 'text-amber-300' },
                { icon: ShieldCheck, label: t('step3'), color: 'text-sky-300' },
              ].map((step, i) => (
                <div
                  key={step.label}
                  className="flex items-center gap-4 rounded-2xl bg-white/5 p-4 backdrop-blur"
                  style={{ animationDelay: `${0.15 * (i + 1)}s` }}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                    <step.icon className={`h-5 w-5 ${step.color}`} />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-white/40">0{i + 1}</p>
                    <p className="font-medium text-white">{step.label}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-teal-500/15 p-4">
                <Droplets className="mb-2 h-5 w-5 text-teal-300" />
                <p className="font-semibold text-white">{t('plumbing')}</p>
              </div>
              <div className="rounded-2xl bg-amber-400/15 p-4">
                <Zap className="mb-2 h-5 w-5 text-amber-300" />
                <p className="font-semibold text-white">{t('electrical')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
