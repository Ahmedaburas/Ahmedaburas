import {
  ArrowRight,
  Building2,
  CheckCircle2,
  LayoutDashboard,
  MapPin,
  Network,
  Radar,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Logo } from '../components/Logo'
import { useI18n } from '../i18n'
import { useStore } from '../store/store'

const HERO_SLIDES = [
  '/hero/tech-field-1.jpg',
  '/hero/tech-field-2.jpg',
  '/hero/tech-field-3.jpg',
]

type PillarId = 'storefront' | 'leads' | 'dispatch' | 'tower' | 'network'

export function Landing() {
  const { t } = useI18n()
  const { currentUser } = useStore()
  const [slide, setSlide] = useState(0)
  const [activePillar, setActivePillar] = useState<PillarId | null>('storefront')

  useEffect(() => {
    const id = window.setInterval(() => {
      setSlide((s) => (s + 1) % HERO_SLIDES.length)
    }, 7000)
    return () => window.clearInterval(id)
  }, [])

  const dash =
    currentUser?.role === 'admin'
      ? '/admin'
      : currentUser?.role === 'technician'
        ? '/tech'
        : currentUser?.role === 'provider'
          ? '/provider'
          : '/app'

  const requestHref = currentUser
    ? currentUser.role === 'customer'
      ? '/app/book'
      : dash
    : '/signup'

  const pillars: {
    id: PillarId
    icon: typeof Building2
    label: string
    demoTitle: string
    demoBody: string
    demoSteps: string[]
  }[] = [
    {
      id: 'storefront',
      icon: Building2,
      label: t('pillarStorefront'),
      demoTitle: t('pillarDemoStorefrontTitle'),
      demoBody: t('pillarDemoStorefrontBody'),
      demoSteps: [t('pillarDemoStorefrontS1'), t('pillarDemoStorefrontS2'), t('pillarDemoStorefrontS3')],
    },
    {
      id: 'leads',
      icon: Sparkles,
      label: t('pillarLeads'),
      demoTitle: t('pillarDemoLeadsTitle'),
      demoBody: t('pillarDemoLeadsBody'),
      demoSteps: [t('pillarDemoLeadsS1'), t('pillarDemoLeadsS2'), t('pillarDemoLeadsS3')],
    },
    {
      id: 'dispatch',
      icon: LayoutDashboard,
      label: t('pillarDispatch'),
      demoTitle: t('pillarDemoDispatchTitle'),
      demoBody: t('pillarDemoDispatchBody'),
      demoSteps: [t('pillarDemoDispatchS1'), t('pillarDemoDispatchS2'), t('pillarDemoDispatchS3')],
    },
    {
      id: 'tower',
      icon: Radar,
      label: t('pillarTower'),
      demoTitle: t('pillarDemoTowerTitle'),
      demoBody: t('pillarDemoTowerBody'),
      demoSteps: [t('pillarDemoTowerS1'), t('pillarDemoTowerS2'), t('pillarDemoTowerS3')],
    },
    {
      id: 'network',
      icon: Network,
      label: t('pillarNetwork'),
      demoTitle: t('pillarDemoNetworkTitle'),
      demoBody: t('pillarDemoNetworkBody'),
      demoSteps: [t('pillarDemoNetworkS1'), t('pillarDemoNetworkS2'), t('pillarDemoNetworkS3')],
    },
  ]

  const active = pillars.find((p) => p.id === activePillar) || pillars[0]

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Full-bleed movable maintenance photography */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {HERO_SLIDES.map((src, i) => (
          <div
            key={src}
            className={`absolute inset-0 transition-opacity duration-[1800ms] ease-out ${
              i === slide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={src}
              alt=""
              className={`h-full w-full object-cover ${i === slide ? 'animate-ken-burns' : ''}`}
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950/88 via-navy-900/78 to-navy-900/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-transparent to-navy-950/40" />
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
              className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/25 sm:px-5 sm:py-2.5 sm:text-sm"
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
                className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/30 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                {t('joinAsProvider')}
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-center px-4 pb-16 pt-6">
        <div className="max-w-3xl animate-fade-up">
          <p className="mb-3 text-4xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-5xl lg:text-6xl">
            {t('brand')}
          </p>
          <h1 className="text-2xl font-bold leading-snug text-teal-200 sm:text-3xl lg:text-4xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
            {t('heroSub')}
          </p>

          {/* Primary CTA — Request service (most visible) */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              to={requestHref}
              className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-teal-400 px-8 py-4 text-base font-bold text-navy-950 shadow-[0_12px_40px_rgba(45,212,191,0.45)] transition hover:bg-teal-300 hover:shadow-[0_16px_48px_rgba(45,212,191,0.55)] active:scale-[0.98] sm:text-lg"
            >
              <span className="absolute inset-0 animate-cta-shine bg-gradient-to-r from-transparent via-white/35 to-transparent" />
              <Wrench className="relative h-5 w-5" />
              <span className="relative">{t('requestServiceCta')}</span>
              <ArrowRight className="relative h-5 w-5 transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </Link>
            <Link
              to={currentUser ? dash : '/signup/provider'}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/10 px-6 py-3.5 font-semibold text-white backdrop-blur hover:bg-white/15"
            >
              {t('joinAsProvider')}
            </Link>
            <Link
              to="/partners"
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-white/75 hover:text-white"
            >
              {t('viewPricing')}
            </Link>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-teal-200/90">
            <MapPin className="h-4 w-4" />
            {t('launchMarket')}: {t('easternProvince')}
          </p>
        </div>

        {/* Interactive pillars + live demo panel */}
        <div className="mt-14 animate-fade-up stagger-2">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/55">
            {t('pillarsTitle')}
          </p>
          <p className="mb-4 max-w-2xl text-sm text-white/65">{t('pillarsHint')}</p>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {pillars.map((p) => {
                const selected = activePillar === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActivePillar(p.id)}
                    onMouseEnter={() => setActivePillar(p.id)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-start transition ${
                      selected
                        ? 'border-teal-300/60 bg-teal-400/20 shadow-[0_0_0_1px_rgba(45,212,191,0.35)]'
                        : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
                    }`}
                    aria-pressed={selected}
                  >
                    <p.icon className={`h-5 w-5 shrink-0 ${selected ? 'text-teal-200' : 'text-teal-300/80'}`} />
                    <span className="text-sm font-semibold text-white">{p.label}</span>
                  </button>
                )
              })}
            </div>

            <div
              key={active.id}
              className="animate-fade-in rounded-3xl border border-white/15 bg-navy-950/55 p-5 shadow-xl backdrop-blur-md sm:p-6"
            >
              <div className="mb-3 flex items-center gap-2 text-teal-300">
                <active.icon className="h-5 w-5" />
                <p className="text-xs font-bold uppercase tracking-[0.16em]">{t('pillarDemoLive')}</p>
              </div>
              <h2 className="text-xl font-bold text-white">{active.demoTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{active.demoBody}</p>
              <ul className="mt-5 space-y-3">
                {active.demoSteps.map((step, i) => (
                  <li
                    key={step}
                    className="flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white/90"
                    style={{ animationDelay: `${0.05 * (i + 1)}s` }}
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 animate-progress-slide rounded-full bg-gradient-to-r from-teal-400 to-amber-300" />
              </div>
              <p className="mt-2 text-[11px] text-white/45">{t('pillarDemoProgress')}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
