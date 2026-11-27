import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="card-surface flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 h-12 w-12 rounded-2xl bg-sand-100" />
      <h3 className="font-semibold text-navy-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-navy-700/60">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
