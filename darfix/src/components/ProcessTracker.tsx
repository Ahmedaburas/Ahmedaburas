import { Check, Clock3, MapPin, StickyNote, Wrench } from 'lucide-react'
import { useI18n } from '../i18n'
import type { Booking, BookingStatus } from '../store/types'

const PIPELINE: BookingStatus[] = [
  'new_request',
  'confirmed',
  'technician_assigned',
  'on_the_way',
  'arrived',
  'in_progress',
  'awaiting_approval',
  'completed',
]

function stepIndex(status: BookingStatus) {
  if (status === 'cancelled') return -1
  return PIPELINE.indexOf(status)
}

export function ProcessTracker({
  booking,
  editableChecklist,
  onToggleChecklist,
}: {
  booking: Booking
  editableChecklist?: boolean
  onToggleChecklist?: (itemId: string, done: boolean) => void
}) {
  const { t, locale, statusLabel } = useI18n()
  const process = booking.process
  const current = stepIndex(booking.status)
  const visible = PIPELINE.filter((s) => s !== 'awaiting_approval' || booking.status === 'awaiting_approval' || booking.extraWork.some((e) => e.status === 'pending'))

  return (
    <div className="space-y-5">
      <div className="card-surface p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-navy-900">{t('trackStatus')}</h2>
            {process?.currentStepNote && (
              <p className="mt-1 text-sm text-teal-700">{process.currentStepNote}</p>
            )}
          </div>
          {process?.estimatedArrival && booking.status === 'on_the_way' && (
            <div className="rounded-xl bg-teal-50 px-3 py-2 text-end">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700/70">
                ETA
              </p>
              <p className="text-sm font-bold text-navy-900">
                {new Date(process.estimatedArrival).toLocaleTimeString(
                  locale === 'ar' ? 'ar-SA' : 'en-SA',
                  { hour: '2-digit', minute: '2-digit' },
                )}
              </p>
            </div>
          )}
        </div>

        <ol className="space-y-0">
          {visible.map((status, i) => {
            const idx = stepIndex(status)
            const done = current > idx || booking.status === 'completed'
            const active = booking.status === status
            const hist = [...booking.statusHistory].reverse().find((h) => h.status === status)
            return (
              <li key={status} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      done || active
                        ? 'bg-teal-500 text-white'
                        : 'bg-navy-100 text-navy-700/50'
                    } ${active ? 'ring-4 ring-teal-500/20' : ''}`}
                  >
                    {done && !active ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  {i < visible.length - 1 && (
                    <span className={`w-0.5 flex-1 min-h-6 ${done ? 'bg-teal-400' : 'bg-navy-100'}`} />
                  )}
                </div>
                <div className="pb-5">
                  <p className={`text-sm font-semibold ${active ? 'text-teal-700' : 'text-navy-900'}`}>
                    {statusLabel(status)}
                  </p>
                  {hist && (
                    <p className="text-xs text-navy-700/45">
                      {new Date(hist.at).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-SA')}
                      {hist.note ? ` · ${hist.note}` : ''}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        {(process?.arrivedAt || process?.startedAt || process?.completedAt) && (
          <div className="mt-2 grid gap-2 rounded-xl bg-sand-50 p-3 text-xs text-navy-700/70 sm:grid-cols-3">
            {process.arrivedAt && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-teal-500" />
                Arrived{' '}
                {new Date(process.arrivedAt).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-SA', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            {process.startedAt && (
              <span className="inline-flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-teal-500" />
                Started{' '}
                {new Date(process.startedAt).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-SA', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            {process.completedAt && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-teal-500" />
                Done{' '}
                {new Date(process.completedAt).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-SA', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        )}
      </div>

      {process?.workChecklist && process.workChecklist.length > 0 && (
        <div className="card-surface p-5">
          <h2 className="mb-3 font-semibold text-navy-900">
            {locale === 'ar' ? 'قائمة أعمال المهمة' : 'Job checklist'}
          </h2>
          <ul className="space-y-2">
            {process.workChecklist.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-navy-50 px-3 py-2.5 text-sm hover:bg-sand-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-500"
                    checked={item.done}
                    disabled={!editableChecklist}
                    onChange={(e) => onToggleChecklist?.(item.id, e.target.checked)}
                  />
                  <span className={item.done ? 'text-navy-700/45 line-through' : 'text-navy-900'}>
                    {item.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-navy-700/45">
            {process.workChecklist.filter((c) => c.done).length}/{process.workChecklist.length}{' '}
            {locale === 'ar' ? 'مكتمل' : 'done'}
          </p>
        </div>
      )}

      {process?.technicianNotes && process.technicianNotes.length > 0 && (
        <div className="card-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-navy-900">
            <StickyNote className="h-4 w-4 text-teal-500" />
            {locale === 'ar' ? 'ملاحظات التقدم' : 'Progress notes'}
          </h2>
          <ul className="space-y-3">
            {[...process.technicianNotes].reverse().map((n) => (
              <li key={n.id} className="rounded-xl bg-sand-50 px-3 py-2.5">
                <p className="text-sm text-navy-800">{n.text}</p>
                <p className="mt-1 text-[11px] text-navy-700/45">
                  {new Date(n.at).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-SA')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
