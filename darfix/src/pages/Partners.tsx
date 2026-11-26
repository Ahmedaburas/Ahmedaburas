import { ArrowRight, BadgeCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Logo } from '../components/Logo'
import { useI18n } from '../i18n'
import { SUBSCRIPTION_PLANS } from '../store/types'

export function Partners() {
  const { t, locale } = useI18n()

  return (
    <div className="min-h-screen bg-sand-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-navy-900/8 to-transparent" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <Link to="/signup/provider" className="btn-primary px-4 py-2 text-sm">
            {t('joinAsProvider')}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-6">
        <div className="animate-fade-up max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-600">
            {t('brand')} · {t('easternProvince')}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
            {t('pricingTitle')}
          </h1>
          <p className="mt-3 text-navy-700/70">{t('pricingSub')}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {SUBSCRIPTION_PLANS.map((plan, i) => (
            <div
              key={plan.id}
              className={`animate-fade-up rounded-2xl border p-5 ${
                plan.id === 'pro'
                  ? 'border-teal-400 bg-navy-900 text-white shadow-lg shadow-navy-900/20'
                  : 'border-navy-100 bg-white'
              }`}
              style={{ animationDelay: `${0.05 * i}s` }}
            >
              <p
                className={`text-sm font-semibold ${plan.id === 'pro' ? 'text-teal-300' : 'text-teal-600'}`}
              >
                {locale === 'ar' ? plan.nameAr : plan.nameEn}
              </p>
              <p className={`mt-3 text-2xl font-extrabold ${plan.id === 'pro' ? 'text-white' : 'text-navy-900'}`}>
                {locale === 'ar' ? plan.priceLabelAr : plan.priceLabelEn}
              </p>
              {plan.id === 'pro' && (
                <p className="mt-2 text-xs text-white/60">Most partners start here</p>
              )}
            </div>
          ))}
        </div>

        <div className="animate-fade-up stagger-2 mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-8 text-white">
          <div className="flex flex-wrap items-start gap-3">
            <BadgeCheck className="h-6 w-6 text-teal-300" />
            <div>
              <h2 className="text-xl font-bold">{t('foundingPartners')}</h2>
              <p className="mt-2 max-w-2xl text-white/70">{t('foundingOffer')}</p>
              <Link
                to="/signup/provider"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-400 px-5 py-2.5 font-semibold text-navy-950 hover:bg-teal-300"
              >
                {t('joinAsProvider')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-navy-700/50">
          {t('limitedCompetition')}
        </p>
      </main>
    </div>
  )
}
