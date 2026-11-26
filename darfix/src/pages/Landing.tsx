import {
  ArrowRight,
  Building2,
  LayoutDashboard,
  Network,
  Radar,
  Sparkles,
  Users,
} from 'lucide-react'
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
        : currentUser?.role === 'provider'
          ? '/provider'
          : '/app'

  const pillars = [
    { icon: Building2, label: t('pillarStorefront') },
    { icon: Sparkles, label: t('pillarLeads') },
    { icon: LayoutDashboard, label: t('pillarDispatch') },
    { icon: Radar, label: t('pillarTower') },
    { icon: Network, label: t('pillarNetwork') },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-teal-600/80" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        />
        <div className="absolute -end-24 top-1/4 h-[480px] w-[480px] rounded-full bg-teal-400/20 blur-3xl animate-pulse-soft" />
        <div className="absolute -start-32 bottom-0 h-[360px] w-[360px] rounded-full bg-white/5 blur-3xl" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:py-5">
        <Logo light />
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <LanguageSwitcher compact light />
          <Link
            to="/partners"
            className="hidden rounded-xl px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 sm:inline-flex sm:text-sm"
          >
            {t('forPartners')}
          </Link>
          {currentUser ? (
            <Link
              to={dash}
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-navy-900 sm:px-5 sm:py-2.5 sm:text-sm"
            >
              {t('dashboard')}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 sm:inline-flex"
              >
                {t('signIn')}
              </Link>
              <Link
                to="/signup/provider"
                className="rounded-xl bg-teal-400 px-3 py-2 text-xs font-semibold text-navy-950 sm:px-5 sm:py-2.5 sm:text-sm"
              >
                {t('joinAsProvider')}
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-center px-4 pb-20 pt-6">
        <div className="max-w-3xl animate-fade-up">
          <p className="mb-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {t('brand')}
          </p>
          <h1 className="text-2xl font-bold leading-snug text-teal-200 sm:text-3xl lg:text-4xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
            {t('heroSub')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={currentUser ? dash : '/signup/provider'}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-6 py-3 font-semibold text-navy-950 transition hover:bg-teal-300"
            >
              {t('joinAsProvider')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
            <Link
              to="/partners"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              {t('viewPricing')}
            </Link>
            <Link
              to={currentUser ? '/app/book' : '/signup'}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white/70 hover:text-white"
            >
              <Users className="h-4 w-4" />
              {t('bookService')}
            </Link>
          </div>
          <p className="mt-8 text-sm font-medium uppercase tracking-[0.18em] text-teal-300/80">
            {t('launchMarket')}: {t('easternProvince')}
          </p>
        </div>

        <div className="mt-14 animate-fade-up stagger-2">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/45">
            {t('pillarsTitle')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {pillars.map((p, i) => (
              <div
                key={p.label}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
                style={{ animationDelay: `${0.08 * (i + 1)}s` }}
              >
                <p.icon className="h-5 w-5 shrink-0 text-teal-300" />
                <span className="text-sm font-medium text-white/90">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
