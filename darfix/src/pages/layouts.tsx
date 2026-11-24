import { AppShell } from '../components/Layout'
import { useI18n } from '../i18n'

export function CustomerLayout() {
  const { t } = useI18n()
  return (
    <AppShell
      title={t('customer')}
      nav={[
        { to: '/app', label: t('dashboard') },
        { to: '/app/book', label: t('bookService') },
        { to: '/app/notifications', label: t('notifications') },
      ]}
    />
  )
}

export function TechLayout() {
  const { t } = useI18n()
  return (
    <AppShell
      title={t('technician')}
      nav={[
        { to: '/tech', label: t('assignedJobs') },
        { to: '/tech/notifications', label: t('notifications') },
      ]}
    />
  )
}

export function AdminLayout() {
  const { t } = useI18n()
  return (
    <AppShell
      title={t('admin')}
      nav={[
        { to: '/admin', label: t('overview') },
        { to: '/admin/bookings', label: t('bookings') },
        { to: '/admin/customers', label: t('customers') },
        { to: '/admin/technicians', label: t('technicians') },
        { to: '/admin/pricing', label: t('pricing') },
        { to: '/admin/reviews', label: t('reviews') },
        { to: '/admin/discounts', label: t('discounts') },
        { to: '/admin/reports', label: t('reports') },
        { to: '/admin/notifications', label: t('notifications') },
      ]}
    />
  )
}
