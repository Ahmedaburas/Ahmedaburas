import type { ServiceCategoryId } from '../config/services'

export type UserRole = 'customer' | 'technician' | 'admin' | 'provider'

export type ProviderKind = 'company' | 'independent'
export type EmploymentType = 'independent' | 'company'
export type AssignmentMode = 'named_tech' | 'company_pool'
export type OrgMemberRole = 'owner' | 'dispatcher' | 'technician'

export interface ProviderOrganization {
  id: string
  kind: ProviderKind
  name: string
  nameAr: string
  cityId: string
  phone?: string
  email?: string
  commercialRegistration?: string
  licenseNumber?: string
  status: 'active' | 'pending_review' | 'suspended'
  createdAt: string
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  memberRole: OrgMemberRole
  active: boolean
  createdAt: string
}

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

export type NotificationType =
  | 'booking_confirmed'
  | 'technician_assigned'
  | 'on_the_way'
  | 'job_completed'
  | 'extra_work'
  | 'quotation'
  | 'general'

export interface User {
  id: string
  role: UserRole
  name: string
  nameAr: string
  email: string
  phone: string
  password?: string
  cityId?: string
  districtId?: string
  specialties?: ServiceCategoryId[]
  rating?: number
  reviewCount?: number
  active?: boolean
  avatarColor?: string
  /** Set for technicians (and provider owners who also field). */
  employmentType?: EmploymentType
  organizationId?: string
}

export interface BookingAddress {
  cityId: string
  districtId: string
  street: string
  building?: string
  notes?: string
  lat?: number
  lng?: number
}

export interface CostLine {
  id: string
  label: string
  amountSar: number
  type: 'labor' | 'materials' | 'fee' | 'discount'
}

export interface ExtraWorkRequest {
  id: string
  description: string
  amountSar: number
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export interface JobPhoto {
  id: string
  kind: 'before' | 'after' | 'issue'
  dataUrl: string
  caption?: string
  uploadedAt: string
}

export interface Quotation {
  id: string
  bookingId: string
  lines: CostLine[]
  totalSar: number
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
  createdAt: string
}

export interface Invoice {
  id: string
  bookingId: string
  customerId: string
  lines: CostLine[]
  totalSar: number
  status: 'unpaid' | 'paid' | 'refunded'
  createdAt: string
  paidAt?: string
}

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

export interface Booking {
  id: string
  customerId: string
  technicianId?: string
  /** Provider org handling the job (company pool or independent tech's org). */
  organizationId?: string
  assignmentMode?: AssignmentMode
  categoryId: ServiceCategoryId
  problemId: string
  description: string
  photos: JobPhoto[]
  address: BookingAddress
  preferredDate: string
  preferredTimeSlot: string
  estimatedFeeSar: number
  status: BookingStatus
  costs: CostLine[]
  extraWork: ExtraWorkRequest[]
  jobReport?: string
  rating?: number
  reviewText?: string
  reviewedAt?: string
  discountCode?: string
  discountAmountSar?: number
  process?: BookingProcess
  createdAt: string
  updatedAt: string
  statusHistory: { status: BookingStatus; at: string; by?: string; note?: string }[]
}

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  titleEn: string
  titleAr: string
  bodyEn: string
  bodyAr: string
  bookingId?: string
  read: boolean
  createdAt: string
}

export interface DiscountCode {
  id: string
  code: string
  percentOff: number
  active: boolean
  maxUses: number
  usedCount: number
  expiresAt?: string
}

export interface PricingOverride {
  categoryId: ServiceCategoryId
  problemId: string
  baseFeeSar: number
}

export interface AppState {
  users: User[]
  bookings: Booking[]
  notifications: AppNotification[]
  quotations: Quotation[]
  invoices: Invoice[]
  discountCodes: DiscountCode[]
  pricingOverrides: PricingOverride[]
  organizations: ProviderOrganization[]
  organizationMembers: OrganizationMember[]
  sessionUserId: string | null
  locale: 'en' | 'ar'
}

export const TIME_SLOTS = [
  { id: '08-10', labelEn: '8:00 – 10:00 AM', labelAr: '٨:٠٠ – ١٠:٠٠ ص' },
  { id: '10-12', labelEn: '10:00 AM – 12:00 PM', labelAr: '١٠:٠٠ ص – ١٢:٠٠ م' },
  { id: '12-14', labelEn: '12:00 – 2:00 PM', labelAr: '١٢:٠٠ – ٢:٠٠ م' },
  { id: '14-16', labelEn: '2:00 – 4:00 PM', labelAr: '٢:٠٠ – ٤:٠٠ م' },
  { id: '16-18', labelEn: '4:00 – 6:00 PM', labelAr: '٤:٠٠ – ٦:٠٠ م' },
  { id: '18-20', labelEn: '6:00 – 8:00 PM', labelAr: '٦:٠٠ – ٨:٠٠ م' },
] as const

export const BOOKING_STATUSES: BookingStatus[] = [
  'new_request',
  'confirmed',
  'technician_assigned',
  'on_the_way',
  'arrived',
  'in_progress',
  'awaiting_approval',
  'completed',
  'cancelled',
]
