import { Plus, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BookingCard } from '../../components/BookingCard'
import { EmptyState } from '../../components/EmptyState'
import { useI18n } from '../../i18n'
import { useStore } from '../../store/store'

export function CustomerHome() {
  const { currentUser, state } = useStore()
  const { t, displayName } = useI18n()

  const mine = state.bookings.filter((b) => b.customerId === currentUser?.id)
  const active = mine.filter((b) => b.status !== 'completed' && b.status !== 'cancelled')
  const past = mine.filter((b) => b.status === 'completed' || b.status === 'cancelled')

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-navy-700/55">{t('welcomeBack')}</p>
          <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
            {currentUser && displayName(currentUser.name, currentUser.nameAr)}
          </h1>
        </div>
        <Link to="/app/book" className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('bookService')}
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-navy-900">{t('trackStatus')}</h2>
        {active.length === 0 ? (
          <EmptyState
            title={t('noData')}
            action={
              <Link to="/app/book" className="btn-primary">
                {t('bookService')}
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((b) => (
              <BookingCard key={b.id} booking={b} to={`/app/bookings/${b.id}`} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">{t('pastBookings')}</h2>
          <Star className="h-4 w-4 text-navy-700/30" />
        </div>
        {past.length === 0 ? (
          <p className="text-sm text-navy-700/50">{t('noData')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {past.map((b) => (
              <BookingCard key={b.id} booking={b} to={`/app/bookings/${b.id}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
