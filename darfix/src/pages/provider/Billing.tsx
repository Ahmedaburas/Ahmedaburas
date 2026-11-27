import { CreditCard, Loader2, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useI18n } from '../../i18n'
import { useStore } from '../../store/store'
import { SUBSCRIPTION_PLANS } from '../../store/types'

export function ProviderBilling() {
  const { t, locale, formatSar } = useI18n()
  const { actions } = useStore()
  const [search] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [busyPlan, setBusyPlan] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sub, setSub] = useState<Awaited<ReturnType<typeof api.orgSubscription>> | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.orgSubscription()
      setSub(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const checkoutId = search.get('checkout')
    const paid = search.get('paid')
    if (paid === '1' && checkoutId && sub?.paymentsProvider === 'mock') {
      setNotice(t('billingMockHint'))
    } else if (paid === '1') {
      setNotice(t('billingPaidPending'))
      void actions.refresh().catch(() => undefined)
      void refresh()
    }
  }, [search, sub?.paymentsProvider, t, actions, refresh])

  async function startCheckout(planId: string) {
    setBusyPlan(planId)
    setError('')
    setNotice('')
    try {
      const result = await api.startSubscriptionCheckout(planId)
      if (result.simulateAvailable && result.checkout.id) {
        const done = await api.simulateSubscriptionCheckout(result.checkout.id)
        setNotice(t('billingActivated'))
        setSub((prev) =>
          prev
            ? {
                ...prev,
                organization: done.organization,
                subscriptionStatus: 'active',
                plan: done.organization.subscriptionPlan || planId,
                trialEndsAt: null,
                trialActive: false,
                paywall: false,
              }
            : prev,
        )
        await actions.refresh()
        await refresh()
        return
      }
      if (result.checkout.checkoutUrl) {
        window.location.href = result.checkout.checkoutUrl
        return
      }
      setError('No checkout URL returned')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setBusyPlan(null)
    }
  }

  async function simulatePending(checkoutId: string) {
    setBusyPlan(checkoutId)
    setError('')
    try {
      await api.simulateSubscriptionCheckout(checkoutId)
      setNotice(t('billingActivated'))
      await actions.refresh()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulate failed')
    } finally {
      setBusyPlan(null)
    }
  }

  if (loading && !sub) {
    return (
      <div className="flex items-center gap-2 text-navy-700/60">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  const planMeta = SUBSCRIPTION_PLANS.find((p) => p.id === (sub?.plan || 'launch'))
  const status = sub?.subscriptionStatus || 'none'

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-600">
          {t('billing')}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-navy-900">{t('billingTitle')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-navy-700/65">{t('billingSub')}</p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          {notice}
        </p>
      )}

      {sub?.paywall && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-950">
          <p className="font-semibold">{t('paywallTitle')}</p>
          <p className="mt-1 text-sm text-amber-900/80">{t('paywallBody')}</p>
        </div>
      )}

      <section className="rounded-2xl border border-navy-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-navy-700/45">{t('planBadge')}</p>
            <p className="mt-1 text-xl font-bold text-navy-900">
              {locale === 'ar' ? planMeta?.nameAr : planMeta?.nameEn}
            </p>
            <p className="mt-1 text-sm text-navy-700/60">
              {t('subscriptionStatus')}: <span className="font-medium text-navy-900">{status}</span>
              {sub?.trialEndsAt && (
                <>
                  {' '}
                  · {t('trialEnds')}: {new Date(sub.trialEndsAt).toLocaleDateString()}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-800">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
            {sub?.paymentsProvider === 'moyasar' ? 'Moyasar' : 'Mock'} · Mada / Visa / MC
          </div>
        </div>
        <p className="mt-4 text-xs text-navy-700/50">{t('billingNoCrNote')}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-navy-900">{t('payWithCards')}</h2>
        <p className="mt-1 text-sm text-navy-700/60">{t('payWithCardsSub')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(sub?.checkoutPlans || []).map((plan) => {
            const meta = SUBSCRIPTION_PLANS.find((p) => p.id === plan.id)
            const current = sub?.plan === plan.id && status === 'active'
            return (
              <div key={plan.id} className="rounded-2xl border border-navy-100 bg-white p-4">
                <p className="text-sm font-semibold text-teal-700">
                  {locale === 'ar' ? meta?.nameAr : meta?.nameEn}
                </p>
                <p className="mt-2 text-2xl font-extrabold text-navy-900">
                  {plan.priceSar != null ? formatSar(plan.priceSar) : '—'}
                  <span className="text-sm font-medium text-navy-700/50">/{t('month')}</span>
                </p>
                <p className="mt-1 text-xs text-navy-700/55">
                  {locale === 'ar' ? meta?.seatsLabelAr : meta?.seatsLabelEn}
                </p>
                <button
                  type="button"
                  disabled={Boolean(busyPlan) || current}
                  onClick={() => void startCheckout(plan.id)}
                  className="btn-primary mt-4 flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm disabled:opacity-50"
                >
                  {busyPlan === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  {current ? t('currentPlan') : t('payNow')}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {sub?.pendingCheckouts && sub.pendingCheckouts.length > 0 && (
        <section className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="font-semibold text-navy-900">{t('pendingCheckouts')}</h2>
          <ul className="mt-3 space-y-2">
            {sub.pendingCheckouts.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sand-50 px-3 py-2 text-sm"
              >
                <span>
                  {c.planId} · {formatSar(c.amountSar)} · {c.provider}
                </span>
                <div className="flex gap-2">
                  {c.checkoutUrl && c.provider !== 'mock' && (
                    <a href={c.checkoutUrl} className="text-teal-700 underline">
                      {t('continueCheckout')}
                    </a>
                  )}
                  {c.provider === 'mock' && (
                    <button
                      type="button"
                      className="font-semibold text-teal-700"
                      disabled={Boolean(busyPlan)}
                      onClick={() => void simulatePending(c.id)}
                    >
                      {t('simulatePay')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-navy-700/50">
        <Link to="/partners" className="text-teal-700 underline">
          {t('viewPricing')}
        </Link>
        {' · '}
        <Link to="/provider" className="text-teal-700 underline">
          {t('dashboard')}
        </Link>
      </p>
    </div>
  )
}
