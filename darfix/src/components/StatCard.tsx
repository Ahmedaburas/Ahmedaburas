import type { ReactNode } from 'react'

export function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string | number
  icon?: ReactNode
  accent?: string
}) {
  return (
    <div className="card-surface animate-fade-up p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-navy-700/50">{label}</p>
        {icon && (
          <span className={`rounded-lg p-2 ${accent ?? 'bg-teal-50 text-teal-600'}`}>{icon}</span>
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight text-navy-900">{value}</p>
    </div>
  )
}
