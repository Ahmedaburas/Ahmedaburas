import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { StatusBadge } from '../../components/StatusBadge'
import { useI18n } from '../../i18n'
import { useStore } from '../../store/store'

export function ProviderHome() {
  const { state, currentUser, actions } = useStore()
  const { t, displayName, categoryLabel, problemLabel, formatSar } = useI18n()
  const org = state.organizations.find((o) => o.id === currentUser?.organizationId)
  const memberTechs = useMemo(() => {
    const memberIds = new Set(
      state.organizationMembers
        .filter((m) => m.organizationId === currentUser?.organizationId && m.active)
        .map((m) => m.userId),
    )
    return state.users.filter((u) => u.role === 'technician' && memberIds.has(u.id) && (u.active ?? true))
  }, [state.organizationMembers, state.users, currentUser?.organizationId])

  const [assignMap, setAssignMap] = useState<Record<string, string>>({})

  if (!org) {
    return <EmptyState title={t('noData')} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">
          {displayName(org.name, org.nameAr)}
        </h1>
        <p className="mt-1 text-sm text-navy-700/60">
          {t('companyPool')} · {t('launchMarket')}: {t('jubail')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-wide text-navy-700/45">{t('bookings')}</p>
          <p className="mt-1 text-2xl font-bold text-navy-900">{state.bookings.length}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-wide text-navy-700/45">{t('technicians')}</p>
          <p className="mt-1 text-2xl font-bold text-navy-900">{memberTechs.length}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-wide text-navy-700/45">{t('pending')}</p>
          <p className="mt-1 text-2xl font-bold text-navy-900">
            {state.bookings.filter((b) => !b.technicianId || b.assignmentMode === 'company_pool').length}
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-navy-900">{t('companyPool')}</h2>
        {state.bookings.length === 0 ? (
          <EmptyState title={t('noData')} />
        ) : (
          <div className="space-y-3">
            {state.bookings.map((b) => (
              <div key={b.id} className="card-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-navy-700/45">{b.id}</p>
                    <p className="font-semibold text-navy-900">
                      {categoryLabel(b.categoryId)} · {problemLabel(b.categoryId, b.problemId)}
                    </p>
                    <p className="mt-1 text-sm text-navy-700/60">{b.address.street}</p>
                    <p className="mt-1 text-sm text-navy-700/55">{formatSar(b.estimatedFeeSar)}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>

                {!b.technicianId || b.assignmentMode === 'company_pool' ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <select
                      className="input-field max-w-xs"
                      value={assignMap[b.id] || ''}
                      onChange={(e) => setAssignMap({ ...assignMap, [b.id]: e.target.value })}
                    >
                      <option value="">— {t('assignTechnician')} —</option>
                      {memberTechs
                        .filter((tech) => tech.specialties?.includes(b.categoryId))
                        .map((tech) => (
                          <option key={tech.id} value={tech.id}>
                            {displayName(tech.name, tech.nameAr)}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!assignMap[b.id]}
                      onClick={() => void actions.assignTechnician(b.id, assignMap[b.id])}
                    >
                      {t('assignTechnician')}
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-teal-700">
                    {t('technician')}:{' '}
                    {displayName(
                      state.users.find((u) => u.id === b.technicianId)?.name ?? '',
                      state.users.find((u) => u.id === b.technicianId)?.nameAr ?? '',
                    )}
                  </p>
                )}

                <Link
                  to={`/provider/bookings/${b.id}`}
                  className="mt-3 inline-block text-sm font-semibold text-teal-600 hover:underline"
                >
                  {t('viewDetails')}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
