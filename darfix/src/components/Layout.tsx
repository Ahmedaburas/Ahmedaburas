import { Bell, LogOut, Menu, MessageCircle, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { SUPPORT_WHATSAPP, notificationService } from '../adapters'
import { useI18n } from '../i18n'
import { useStore } from '../store/store'
import { LanguageSwitcher } from './LanguageSwitcher'
import { Logo } from './Logo'

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-xl px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-teal-50 text-teal-600' : 'text-navy-700 hover:bg-sand-100'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export function AppShell({
  nav,
  title,
}: {
  nav: { to: string; label: string }[]
  title?: string
}) {
  const { currentUser, state, actions } = useStore()
  const { t, displayName, locale } = useI18n()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const unread = state.notifications.filter(
    (n) => n.userId === currentUser?.id && !n.read,
  ).length

  const supportUrl = notificationService.getWhatsAppSupportUrl(
    SUPPORT_WHATSAPP,
    locale === 'ar' ? 'مرحباً، أحتاج مساعدة من دارفكس' : 'Hello, I need help from DARFIX',
  )

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-navy-100/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button type="button" className="btn-ghost md:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <Logo />
            {title && (
              <span className="hidden text-sm text-navy-700/60 sm:inline">/ {title}</span>
            )}
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <NavItem key={item.to} to={item.to}>
                {item.label}
              </NavItem>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <LanguageSwitcher compact />
            <Link
              to={
                currentUser?.role === 'admin'
                  ? '/admin/notifications'
                  : currentUser?.role === 'technician'
                    ? '/tech/notifications'
                    : '/app/notifications'
              }
              className="btn-ghost relative"
              aria-label={t('notifications')}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
            <a href={supportUrl} target="_blank" rel="noreferrer" className="btn-ghost" title={t('support')}>
              <MessageCircle className="h-4 w-4" />
            </a>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                void actions.logout().then(() => navigate('/login'))
              }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-navy-950/40"
            onClick={() => setOpen(false)}
            aria-label="Close"
          />
          <aside className="absolute inset-y-0 start-0 w-72 bg-white p-4 shadow-xl animate-fade-in">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 text-sm text-navy-700/70">
              {currentUser && displayName(currentUser.name, currentUser.nameAr)}
            </div>
            <div className="flex flex-col gap-1">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-2.5 text-sm font-medium ${
                      isActive ? 'bg-teal-50 text-teal-600' : 'text-navy-800'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 pb-16">
        <Outlet />
      </main>
    </div>
  )
}

export function PublicHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo large />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link to="/login" className="btn-secondary">
            Sign in
          </Link>
        </div>
      </div>
    </header>
  )
}
