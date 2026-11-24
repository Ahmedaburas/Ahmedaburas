import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { useI18n } from '../i18n'
import { useStore } from '../store/store'

export function NotificationsPage() {
  const { currentUser, state, actions } = useStore()
  const { t, locale } = useI18n()
  const items = state.notifications.filter((n) => n.userId === currentUser?.id)

  const bookingPath = (bookingId?: string) => {
    if (!bookingId || !currentUser) return '#'
    if (currentUser.role === 'admin') return `/admin/bookings/${bookingId}`
    if (currentUser.role === 'technician') return `/tech/jobs/${bookingId}`
    return `/app/bookings/${bookingId}`
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy-900">{t('notifications')}</h1>
        {items.some((n) => !n.read) && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => currentUser && actions.markAllNotificationsRead(currentUser.id)}
          >
            {t('markRead')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState title={t('noNotifications')} />
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <Link
              key={n.id}
              to={bookingPath(n.bookingId)}
              onClick={() => actions.markNotificationRead(n.id)}
              className={`card-surface block p-4 transition hover:border-teal-400/40 ${
                n.read ? 'opacity-70' : 'border-teal-200 bg-teal-50/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy-900">
                    {locale === 'ar' ? n.titleAr : n.titleEn}
                  </p>
                  <p className="mt-1 text-sm text-navy-700/65">
                    {locale === 'ar' ? n.bodyAr : n.bodyEn}
                  </p>
                </div>
                {!n.read && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-teal-500" />}
              </div>
              <p className="mt-2 text-xs text-navy-700/40">
                {new Date(n.createdAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-SA')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
