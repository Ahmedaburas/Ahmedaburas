import type { BookingProcess } from './types'
import { emptyProcess } from './types'

type Row = Record<string, unknown>

export function mapUser(row: Row, includePassword = false) {
  return {
    id: row.id as string,
    role: row.role as string,
    name: row.name as string,
    nameAr: row.name_ar as string,
    email: row.email as string,
    phone: row.phone as string,
    password: includePassword ? '***' : undefined,
    cityId: (row.city_id as string) || undefined,
    districtId: (row.district_id as string) || undefined,
    specialties: row.specialties ? JSON.parse(row.specialties as string) : undefined,
    rating: (row.rating as number) ?? undefined,
    reviewCount: (row.review_count as number) ?? undefined,
    active: row.active === undefined || row.active === null ? true : Boolean(row.active),
    avatarColor: (row.avatar_color as string) || undefined,
  }
}

export function mapBooking(row: Row) {
  let process: BookingProcess
  try {
    process = { ...emptyProcess(), ...(JSON.parse((row.process as string) || '{}') as BookingProcess) }
  } catch {
    process = emptyProcess()
  }
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    technicianId: (row.technician_id as string) || undefined,
    categoryId: row.category_id as string,
    problemId: row.problem_id as string,
    description: row.description as string,
    photos: JSON.parse((row.photos as string) || '[]'),
    address: JSON.parse(row.address as string),
    preferredDate: row.preferred_date as string,
    preferredTimeSlot: row.preferred_time_slot as string,
    estimatedFeeSar: row.estimated_fee_sar as number,
    status: row.status as string,
    costs: JSON.parse((row.costs as string) || '[]'),
    extraWork: JSON.parse((row.extra_work as string) || '[]'),
    jobReport: (row.job_report as string) || undefined,
    rating: (row.rating as number) ?? undefined,
    reviewText: (row.review_text as string) || undefined,
    reviewedAt: (row.reviewed_at as string) || undefined,
    discountCode: (row.discount_code as string) || undefined,
    discountAmountSar: (row.discount_amount_sar as number) ?? undefined,
    process,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    statusHistory: JSON.parse((row.status_history as string) || '[]'),
  }
}

export function mapNotification(row: Row) {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as string,
    titleEn: row.title_en as string,
    titleAr: row.title_ar as string,
    bodyEn: row.body_en as string,
    bodyAr: row.body_ar as string,
    bookingId: (row.booking_id as string) || undefined,
    read: Boolean(row.read),
    createdAt: row.created_at as string,
  }
}

export function mapInvoice(row: Row) {
  return {
    id: row.id as string,
    bookingId: row.booking_id as string,
    customerId: row.customer_id as string,
    lines: JSON.parse((row.lines as string) || '[]'),
    totalSar: row.total_sar as number,
    status: row.status as string,
    createdAt: row.created_at as string,
    paidAt: (row.paid_at as string) || undefined,
  }
}

export function mapQuotation(row: Row) {
  return {
    id: row.id as string,
    bookingId: row.booking_id as string,
    lines: JSON.parse((row.lines as string) || '[]'),
    totalSar: row.total_sar as number,
    status: row.status as string,
    createdAt: row.created_at as string,
  }
}

export function mapDiscount(row: Row) {
  return {
    id: row.id as string,
    code: row.code as string,
    percentOff: row.percent_off as number,
    active: Boolean(row.active),
    maxUses: row.max_uses as number,
    usedCount: row.used_count as number,
    expiresAt: (row.expires_at as string) || undefined,
  }
}
