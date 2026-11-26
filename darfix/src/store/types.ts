import type { ServiceCategoryId } from '../config/services'

export type UserRole = 'customer' | 'technician' | 'admin' | 'provider'

export type ProviderKind = 'company' | 'independent'
export type EmploymentType = 'independent' | 'company'
export type AssignmentMode = 'named_tech' | 'company_pool'
export type OrgMemberRole = 'owner' | 'dispatcher' | 'price_approver' | 'technician'

/** Proposed partner subscription ladder (SAR/mo) — not validated pricing. */
export type SubscriptionPlan = 'launch' | 'growth' | 'pro' | 'business' | 'enterprise'

export type LeadOfferStatus =
  | 'offered'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'expanded'

export type TechResponse = 'pending' | 'accepted' | 'rejected'

export type QuotationStatus =
  | 'draft'
  | 'pending_company_approval'
  | 'company_rejected'
  | 'clarification_requested'
  | 'sent'
  | 'accepted'
  | 'rejected'

export interface ProviderOrganization {
  id: string
  kind: ProviderKind
  name: string
  nameAr: string
  cityId: string
  /** Cities this partner serves (EP launch corridor). */
  serviceCityIds?: string[]
  phone?: string
  email?: string
  commercialRegistration?: string
  licenseNumber?: string
  status: 'active' | 'pending_review' | 'suspended'
  subscriptionPlan?: SubscriptionPlan
  /** none | trialing | active | past_due | canceled */
  subscriptionStatus?: string
  foundingPartner?: boolean
  /** Free trial length in days (Founding / Pro trial). Default 14. */
  trialDays?: number
  trialEndsAt?: string
  whatsapp?: string
  /** Partner SLA response window in hours. */
  slaHours?: number
  /** Declared tech headcount from onboarding survey. */
  techCountDeclared?: number
  specialties?: ServiceCategoryId[]
  priceApproverName?: string
  priceApproverPhone?: string
  onboardingSurvey?: Record<string, unknown>
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

/** Exclusive / limited (1–3) lead offer to a partner org with response deadline. */
export interface LeadOffer {
  id: string
  bookingId: string
  organizationId: string
  status: LeadOfferStatus
  offerRound: number
  offeredAt: string
  deadlineAt: string
  respondedAt?: string
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
  | 'lead_offer'
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
  /** Human-readable unique tech ID, e.g. DFX-JUB-00042. Bound 1:1 to this account. */
  technicianCode?: string
  lastActiveAt?: string
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
  status: QuotationStatus
  createdAt: string
  submittedBy?: string
  companyNote?: string
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
  /** GPS / location share disclosed while job is active (stub or live). */
  gpsSharingActive?: boolean
  lastKnownLat?: number
  lastKnownLng?: number
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
  /** Technician accept/reject of named assignment. */
  techResponse?: TechResponse
  preferredOrganizationId?: string
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
  leadOffers: LeadOffer[]
  sessionUserId: string | null
  locale: 'en' | 'ar'
}

export const SUBSCRIPTION_PLANS: {
  id: SubscriptionPlan
  priceSar: number | null
  priceLabelEn: string
  priceLabelAr: string
  nameEn: string
  nameAr: string
  /** Active technician seats; null = unlimited (Enterprise). */
  maxTechnicians: number | null
  seatsLabelEn: string
  seatsLabelAr: string
}[] = [
  {
    id: 'launch',
    priceSar: 0,
    priceLabelEn: 'Free',
    priceLabelAr: 'مجاني',
    nameEn: 'Launch',
    nameAr: 'إطلاق',
    maxTechnicians: 1,
    seatsLabelEn: '1 technician seat',
    seatsLabelAr: 'مقعد فني واحد',
  },
  {
    id: 'growth',
    priceSar: 149,
    priceLabelEn: '149 SAR/mo',
    priceLabelAr: '١٤٩ ر.س/شهر',
    nameEn: 'Growth',
    nameAr: 'نمو',
    maxTechnicians: 3,
    seatsLabelEn: '3 technician seats',
    seatsLabelAr: '٣ مقاعد فنيين',
  },
  {
    id: 'pro',
    priceSar: 399,
    priceLabelEn: '399 SAR/mo',
    priceLabelAr: '٣٩٩ ر.س/شهر',
    nameEn: 'Pro',
    nameAr: 'احترافي',
    maxTechnicians: 10,
    seatsLabelEn: '10 technician seats',
    seatsLabelAr: '١٠ مقاعد فنيين',
  },
  {
    id: 'business',
    priceSar: 799,
    priceLabelEn: '799 SAR/mo',
    priceLabelAr: '٧٩٩ ر.س/شهر',
    nameEn: 'Business',
    nameAr: 'أعمال',
    maxTechnicians: 25,
    seatsLabelEn: '25 technician seats',
    seatsLabelAr: '٢٥ مقعد فنيين',
  },
  {
    id: 'enterprise',
    priceSar: null,
    priceLabelEn: '1,500–3,500+ SAR/mo',
    priceLabelAr: '١٬٥٠٠–٣٬٥٠٠+ ر.س/شهر',
    nameEn: 'Enterprise',
    nameAr: 'مؤسسات',
    maxTechnicians: null,
    seatsLabelEn: 'Unlimited seats',
    seatsLabelAr: 'مقاعد غير محدودة',
  },
]

/** Default Founding Partner free trial (days). Env override: DARFIX_TRIAL_DAYS. */
export const DEFAULT_TRIAL_DAYS = 14

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
