import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react'
import { StatCard } from '../../components/StatCard'
import { SERVICE_CATEGORIES } from '../../config/services'
import { useI18n } from '../../i18n'
import { useStore } from '../../store/store'

export function AdminOverview() {
  const { state, actions } = useStore()
  const { t, formatSar, locale } = useI18n()

  const today = new Date().toISOString().slice(0, 10)
  const bookings = state.bookings
  const pending = bookings.filter((b) =>
    ['new_request', 'confirmed', 'technician_assigned', 'awaiting_approval'].includes(b.status),
  ).length
  const completed = bookings.filter((b) => b.status === 'completed').length
  const cancelled = bookings.filter((b) => b.status === 'cancelled').length
  const todayCount = bookings.filter((b) => b.createdAt.slice(0, 10) === today).length
  const revenue = state.invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.totalSar, 0)
  const customers = state.users.filter((u) => u.role === 'customer').length
  const technicians = state.users.filter((u) => u.role === 'technician').length

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{t('overview')}</h1>
          <p className="text-sm text-navy-700/55">{t('brand')} · {t('dashboard')}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => actions.resetDemoData()}>
          {t('resetDemo')}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('totalBookings')} value={bookings.length} icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label={t('todayBookings')} value={todayCount} icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label={t('pending')} value={pending} icon={<Wrench className="h-4 w-4" />} accent="bg-amber-50 text-amber-700" />
        <StatCard label={t('completed')} value={completed} icon={<CheckCircle2 className="h-4 w-4" />} accent="bg-emerald-50 text-emerald-700" />
        <StatCard label={t('cancelled')} value={cancelled} icon={<XCircle className="h-4 w-4" />} accent="bg-slate-100 text-slate-600" />
        <StatCard label={t('revenue')} value={formatSar(revenue)} icon={<CircleDollarSign className="h-4 w-4" />} />
        <StatCard label={t('customers')} value={customers} icon={<Users className="h-4 w-4" />} />
        <StatCard label={t('technicians')} value={technicians} icon={<Wrench className="h-4 w-4" />} />
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-navy-900">{t('serviceCategories')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {SERVICE_CATEGORIES.map((cat) => {
            const count = bookings.filter((b) => b.categoryId === cat.id).length
            return (
              <div key={cat.id} className="card-surface p-5">
                <p className="font-bold text-navy-900">
                  {locale === 'ar' ? cat.labelAr : cat.labelEn}
                </p>
                <p className="mt-1 text-sm text-navy-700/55">
                  {count} {t('bookings').toLowerCase()} · {cat.problems.length} problems
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
