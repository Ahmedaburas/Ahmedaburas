import type { BookingStatus } from '../store/types'
import { useI18n } from '../i18n'

const styles: Record<BookingStatus, string> = {
  new_request: 'bg-amber-50 text-amber-800 border-amber-200',
  confirmed: 'bg-sky-50 text-sky-800 border-sky-200',
  technician_assigned: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  on_the_way: 'bg-teal-50 text-teal-800 border-teal-200',
  arrived: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  in_progress: 'bg-blue-50 text-blue-800 border-blue-200',
  awaiting_approval: 'bg-orange-50 text-orange-800 border-orange-200',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { statusLabel } = useI18n()
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {statusLabel(status)}
    </span>
  )
}
