import { useI18n } from '../../i18n'
import { useStore } from '../../store/store'

export function AdminCustomers() {
  const { state } = useStore()
  const { t, displayName, cityLabel } = useI18n()
  const customers = state.users.filter((u) => u.role === 'customer')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-navy-900">{t('customers')}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {customers.map((c) => {
          const count = state.bookings.filter((b) => b.customerId === c.id).length
          return (
            <div key={c.id} className="card-surface p-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-white"
                  style={{ background: c.avatarColor }}
                >
                  {c.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-navy-900">{displayName(c.name, c.nameAr)}</p>
                  <p className="text-xs text-navy-700/55">{c.email}</p>
                </div>
              </div>
              <div className="mt-3 flex justify-between text-sm text-navy-700/65">
                <span>{c.phone}</span>
                <span>
                  {c.cityId ? cityLabel(c.cityId) : '—'} · {count} {t('bookings').toLowerCase()}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AdminTechnicians() {
  const { state, actions } = useStore()
  const { t, displayName, categoryLabel } = useI18n()
  const techs = state.users.filter((u) => u.role === 'technician')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-navy-900">{t('technicians')}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {techs.map((tech) => {
          const jobs = state.bookings.filter((b) => b.technicianId === tech.id).length
          return (
            <div key={tech.id} className="card-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-white"
                    style={{ background: tech.avatarColor }}
                  >
                    {tech.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-navy-900">
                      {displayName(tech.name, tech.nameAr)}
                    </p>
                    <p className="text-xs text-navy-700/55">
                      ★ {tech.rating} · {tech.reviewCount} · {jobs} jobs
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    tech.active ?? true
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                  onClick={() => void actions.toggleTechnician(tech.id)}
                >
                  {tech.active ?? true ? t('active') : t('inactive')}
                </button>
              </div>
              <p className="mt-3 text-sm text-navy-700/65">
                {tech.specialties?.map((s) => categoryLabel(s)).join(' · ')}
              </p>
              <p className="mt-1 text-xs text-navy-700/45">{tech.phone}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
