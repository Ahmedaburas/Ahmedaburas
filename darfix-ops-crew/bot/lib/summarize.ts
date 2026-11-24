type BookingLike = {
  id?: string
  status?: string
  technicianId?: string | null
  categoryId?: string
  problemId?: string
  process?: { currentStepNote?: string } | null
}

export type BookingSummary = {
  id: string
  status: string
  technicianId: string | null
  categoryId: string
  problemId: string
  step: string | null
}

export function summarizeBooking(booking: unknown): BookingSummary {
  const b = (booking || {}) as BookingLike
  return {
    id: String(b.id ?? ""),
    status: String(b.status ?? ""),
    technicianId: b.technicianId ? String(b.technicianId) : null,
    categoryId: String(b.categoryId ?? ""),
    problemId: String(b.problemId ?? ""),
    step: b.process?.currentStepNote ? String(b.process.currentStepNote) : null,
  }
}
