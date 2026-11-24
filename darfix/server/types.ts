export type UserRole = 'customer' | 'technician' | 'admin'

export type BookingStatus =
  | 'new_request'
  | 'confirmed'
  | 'technician_assigned'
  | 'on_the_way'
  | 'arrived'
  | 'in_progress'
  | 'awaiting_approval'
  | 'completed'
  | 'cancelled'

export interface ProcessNote {
  id: string
  at: string
  text: string
  authorId: string
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

export interface BookingProcess {
  estimatedArrival?: string
  arrivedAt?: string
  startedAt?: string
  completedAt?: string
  currentStepNote?: string
  technicianNotes: ProcessNote[]
  workChecklist: ChecklistItem[]
}

export function emptyProcess(): BookingProcess {
  return { technicianNotes: [], workChecklist: [] }
}

export function defaultChecklist(categoryId: string): ChecklistItem[] {
  const base =
    categoryId === 'plumbing'
      ? [
          'Inspect leak / blockage source',
          'Shut off water if needed',
          'Repair or replace faulty part',
          'Test water flow & pressure',
          'Clean work area',
        ]
      : [
          'Diagnose electrical fault safely',
          'Isolate circuit / breaker',
          'Repair or replace component',
          'Test under load',
          'Restore power & clean up',
        ]
  return base.map((label, i) => ({ id: `cl-${i + 1}`, label, done: false }))
}
