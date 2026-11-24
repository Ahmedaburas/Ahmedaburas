import { useState } from 'react'
import { SERVICE_CATEGORIES } from '../../config/services'
import { useI18n } from '../../i18n'
import { useStore } from '../../store/store'
import type { DiscountCode } from '../../store/types'

export function AdminPricing() {
  const { actions } = useStore()
  const { t, locale, formatSar } = useI18n()
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-navy-900">{t('pricing')}</h1>
      <div className="space-y-6">
        {SERVICE_CATEGORIES.map((cat) => (
          <div key={cat.id} className="card-surface overflow-hidden">
            <div className="border-b border-navy-100 bg-sand-50/80 px-4 py-3 font-semibold text-navy-900">
              {locale === 'ar' ? cat.labelAr : cat.labelEn}
            </div>
            <ul className="divide-y divide-navy-50">
              {cat.problems.map((p) => {
                const key = `${cat.id}:${p.id}`
                const current = actions.getEffectiveFee(cat.id, p.id)
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span className="text-sm font-medium text-navy-900">
                      {locale === 'ar' ? p.labelAr : p.labelEn}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        className="input-field w-28"
                        type="number"
                        placeholder={String(current)}
                        value={drafts[key] ?? ''}
                        onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })}
                      />
                      <span className="text-xs text-navy-700/45">{formatSar(current)}</span>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          const val = Number(drafts[key] || current)
                          void actions.setPricingOverride({
                            categoryId: cat.id,
                            problemId: p.id,
                            baseFeeSar: val,
                          })
                          setDrafts({ ...drafts, [key]: '' })
                        }}
                      >
                        {t('savePricing')}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminReviews() {
  const { state } = useStore()
  const { t, displayName, problemLabel } = useI18n()
  const reviewed = state.bookings.filter((b) => b.rating)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-navy-900">{t('reviews')}</h1>
      {reviewed.length === 0 ? (
        <p className="text-navy-700/50">{t('noData')}</p>
      ) : (
        <div className="space-y-3">
          {reviewed.map((b) => {
            const customer = state.users.find((u) => u.id === b.customerId)
            const tech = state.users.find((u) => u.id === b.technicianId)
            return (
              <div key={b.id} className="card-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-navy-900">
                    {problemLabel(b.categoryId, b.problemId)}
                  </p>
                  <span className="text-amber-500">{'★'.repeat(b.rating!)}</span>
                </div>
                <p className="mt-2 text-sm text-navy-800">{b.reviewText}</p>
                <p className="mt-2 text-xs text-navy-700/45">
                  {customer && displayName(customer.name, customer.nameAr)}
                  {tech && ` → ${displayName(tech.name, tech.nameAr)}`} · {b.id}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AdminDiscounts() {
  const { state, actions } = useStore()
  const { t } = useI18n()
  const [form, setForm] = useState({ code: '', percentOff: '10', maxUses: '50' })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-navy-900">{t('discounts')}</h1>

      <div className="card-surface mb-6 p-4">
        <h2 className="mb-3 font-semibold">{t('createCode')}</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="input-field max-w-[160px]"
            placeholder={t('code')}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
          <input
            className="input-field max-w-[100px]"
            type="number"
            placeholder={t('percentOff')}
            value={form.percentOff}
            onChange={(e) => setForm({ ...form, percentOff: e.target.value })}
          />
          <input
            className="input-field max-w-[100px]"
            type="number"
            placeholder={t('uses')}
            value={form.maxUses}
            onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (!form.code) return
              const code: DiscountCode = {
                id: `dc-${Date.now()}`,
                code: form.code,
                percentOff: Number(form.percentOff),
                maxUses: Number(form.maxUses),
                usedCount: 0,
                active: true,
              }
              void actions.upsertDiscount(code)
              setForm({ code: '', percentOff: '10', maxUses: '50' })
            }}
          >
            {t('createCode')}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {state.discountCodes.map((d) => (
          <div key={d.id} className="card-surface flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-mono font-bold text-navy-900">{d.code}</p>
              <p className="text-sm text-navy-700/55">
                {d.percentOff}% · {d.usedCount}/{d.maxUses} {t('uses').toLowerCase()}
              </p>
            </div>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                d.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
              onClick={() => void actions.toggleDiscount(d.id)}
            >
              {d.active ? t('active') : t('inactive')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminReports() {
  const { state } = useStore()
  const { t, formatSar, categoryLabel } = useI18n()

  const byCategory = SERVICE_CATEGORIES.map((cat) => ({
    id: cat.id,
    count: state.bookings.filter((b) => b.categoryId === cat.id).length,
    revenue: state.invoices
      .filter((i) => {
        const b = state.bookings.find((x) => x.id === i.bookingId)
        return b?.categoryId === cat.id && i.status === 'paid'
      })
      .reduce((s, i) => s + i.totalSar, 0),
  }))

  const completionRate =
    state.bookings.length === 0
      ? 0
      : Math.round(
          (state.bookings.filter((b) => b.status === 'completed').length / state.bookings.length) *
            100,
        )

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-navy-900">{t('reports')}</h1>
      <p className="mb-6 text-sm text-navy-700/55">{t('generateReport')}</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-surface p-5">
          <p className="text-xs uppercase tracking-wide text-navy-700/45">{t('totalBookings')}</p>
          <p className="mt-2 text-3xl font-bold">{state.bookings.length}</p>
        </div>
        <div className="card-surface p-5">
          <p className="text-xs uppercase tracking-wide text-navy-700/45">Completion rate</p>
          <p className="mt-2 text-3xl font-bold">{completionRate}%</p>
        </div>
        <div className="card-surface p-5">
          <p className="text-xs uppercase tracking-wide text-navy-700/45">{t('revenue')}</p>
          <p className="mt-2 text-3xl font-bold">
            {formatSar(
              state.invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalSar, 0),
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 card-surface p-5">
        <h2 className="mb-4 font-semibold">{t('serviceCategories')}</h2>
        <div className="space-y-3">
          {byCategory.map((row) => (
            <div key={row.id} className="flex items-center justify-between text-sm">
              <span className="font-medium">{categoryLabel(row.id)}</span>
              <span className="text-navy-700/60">
                {row.count} · {formatSar(row.revenue)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
