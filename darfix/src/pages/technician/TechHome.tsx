import { BookingCard } from '../../components/BookingCard'
import { EmptyState } from '../../components/EmptyState'
import { useI18n } from '../../i18n'
import { useStore } from '../../store/store'

export function TechHome() {
  const { currentUser, state } = useStore()
  const { t, displayName } = useI18n()

  const jobs = state.bookings.filter((b) => b.technicianId === currentUser?.id)
  const active = jobs.filter((b) => b.status !== 'completed' && b.status !== 'cancelled')
  const done = jobs.filter((b) => b.status === 'completed')

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm text-navy-700/55">{t('technician')}</p>
        <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
          {currentUser && displayName(currentUser.name, currentUser.nameAr)}
        </h1>
      </div>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-navy-900">{t('assignedJobs')}</h2>
        {active.length === 0 ? (
          <EmptyState title={t('emptyTechJobsTitle')} description={t('emptyTechJobsDesc')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((b) => (
              <BookingCard key={b.id} booking={b} to={`/tech/jobs/${b.id}`} />
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-navy-900">{t('completed')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {done.map((b) => (
              <BookingCard key={b.id} booking={b} to={`/tech/jobs/${b.id}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
