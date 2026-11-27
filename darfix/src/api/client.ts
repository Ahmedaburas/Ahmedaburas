import type {
  AppState,
  Booking,
  BookingStatus,
  CostLine,
  DiscountCode,
  Invoice,
  JobPhoto,
  PricingOverride,
  ProviderOrganization,
  Quotation,
  User,
} from '../store/types'
import type { ServiceCategoryId } from '../config/services'

const TOKEN_KEY = 'darfix_token'
const LOCALE_KEY = 'darfix_locale'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getStoredLocale(): 'en' | 'ar' {
  return (localStorage.getItem(LOCALE_KEY) as 'en' | 'ar') || 'en'
}

export function setStoredLocale(locale: 'en' | 'ar') {
  localStorage.setItem(LOCALE_KEY, locale)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`/api${path}`, { ...init, headers })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signup: (data: {
    name: string
    nameAr?: string
    email: string
    phone: string
    password: string
    cityId?: string
    districtId?: string
  }) =>
    request<{ token: string; user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  providerSignupConfig: () =>
    request<{ inviteRequired: boolean }>('/auth/signup/provider/config'),

  signupProvider: (data: {
    kind: 'independent' | 'company'
    name: string
    nameAr?: string
    email: string
    phone: string
    password: string
    cityId?: string
    districtId?: string
    specialties?: ServiceCategoryId[]
    companyName?: string
    companyNameAr?: string
    commercialRegistration?: string
    licenseNumber?: string
    whatsapp?: string
    slaHours?: number
    techCount?: number
    serviceCityIds?: string[]
    priceApproverName?: string
    priceApproverPhone?: string
    inviteCode?: string
  }) =>
    request<{ token: string; user: User; organization: unknown }>('/auth/signup/provider', {
      method: 'POST',
      // foundingPartner / trialDays are server-controlled (allowlist); never send from client
      body: JSON.stringify(data),
    }),

  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  bootstrap: (locale: 'en' | 'ar') =>
    request<AppState>(`/bootstrap?locale=${locale}`),

  resetDemo: () =>
    request<{ token: string; state: AppState }>('/demo/reset', { method: 'POST' }),

  getFee: (categoryId: string, problemId: string) =>
    request<{ baseFeeSar: number }>(`/fees/${categoryId}/${problemId}`),

  createBooking: (input: {
    categoryId: ServiceCategoryId
    problemId: string
    description: string
    photos: JobPhoto[]
    address: AppState['bookings'][0]['address']
    preferredDate: string
    preferredTimeSlot: string
    discountCode?: string
    preferredOrganizationId?: string
  }) =>
    request<{ booking: Booking }>('/bookings', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateStatus: (bookingId: string, status: BookingStatus, note?: string) =>
    request<{ booking: Booking }>(`/bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }),

  assignTechnician: (bookingId: string, technicianId?: string, organizationId?: string) =>
    request<{ booking: Booking }>(`/bookings/${bookingId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ technicianId, organizationId }),
    }),

  addPhotos: (bookingId: string, photos: JobPhoto[]) =>
    request<{ booking: Booking }>(`/bookings/${bookingId}/photos`, {
      method: 'POST',
      body: JSON.stringify({ photos }),
    }),

  addCosts: (bookingId: string, costs: CostLine[]) =>
    request<{ booking: Booking }>(`/bookings/${bookingId}/costs`, {
      method: 'POST',
      body: JSON.stringify({ costs }),
    }),

  submitReport: (bookingId: string, report: string) =>
    request<{ booking: Booking }>(`/bookings/${bookingId}/report`, {
      method: 'POST',
      body: JSON.stringify({ report }),
    }),

  requestExtraWork: (bookingId: string, description: string, amountSar: number) =>
    request<{ booking: Booking }>(`/bookings/${bookingId}/extra-work`, {
      method: 'POST',
      body: JSON.stringify({ description, amountSar }),
    }),

  respondExtraWork: (bookingId: string, extraId: string, approve: boolean) =>
    request<{ booking: Booking }>(`/bookings/${bookingId}/extra-work/${extraId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ approve }),
    }),

  rateBooking: (bookingId: string, rating: number, reviewText: string) =>
    request<{ booking: Booking }>(`/bookings/${bookingId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, reviewText }),
    }),

  addProcessNote: (bookingId: string, text: string) =>
    request<{ booking: Booking }>(`/bookings/${bookingId}/process/note`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  toggleChecklist: (bookingId: string, itemId: string, done: boolean) =>
    request<{ booking: Booking }>(`/bookings/${bookingId}/process/checklist`, {
      method: 'PATCH',
      body: JSON.stringify({ itemId, done }),
    }),

  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),

  markAllNotificationsRead: () =>
    request<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),

  payInvoice: (invoiceId: string) =>
    request<{ invoice: Invoice }>(`/invoices/${invoiceId}/pay`, { method: 'POST' }),

  createQuotation: (bookingId: string, lines: CostLine[]) =>
    request<{ quotation: Quotation }>('/quotations', {
      method: 'POST',
      body: JSON.stringify({ bookingId, lines }),
    }),

  reviewQuotation: (quotationId: string, decision: 'approve' | 'reject' | 'clarify', note?: string) =>
    request<{ quotation: Quotation }>(`/quotations/${quotationId}/company-review`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    }),

  respondQuotation: (quotationId: string, approve: boolean) =>
    request<{ quotation: Quotation }>(`/quotations/${quotationId}/customer-respond`, {
      method: 'POST',
      body: JSON.stringify({ approve }),
    }),

  respondLeadOffer: (offerId: string, accept: boolean) =>
    request<{ offer: unknown; booking: Booking }>(`/lead-offers/${offerId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ accept }),
    }),

  techRespond: (bookingId: string, accept: boolean) =>
    request<{ booking: Booking }>(`/bookings/${bookingId}/tech-respond`, {
      method: 'POST',
      body: JSON.stringify({ accept }),
    }),

  setGpsSharing: (bookingId: string, active: boolean, lat?: number, lng?: number) =>
    request<{ booking: Booking }>(`/bookings/${bookingId}/gps`, {
      method: 'POST',
      body: JSON.stringify({ active, lat, lng }),
    }),

  listPartners: () =>
    request<{ partners: unknown[]; launchRegion: string }>('/partners'),

  upsertDiscount: (code: DiscountCode) =>
    request<{ discount: DiscountCode }>('/discounts', {
      method: 'POST',
      body: JSON.stringify(code),
    }),

  toggleDiscount: (id: string) =>
    request<{ discount: DiscountCode }>(`/discounts/${id}/toggle`, { method: 'POST' }),

  setPricing: (override: PricingOverride) =>
    request<{ override: PricingOverride }>('/pricing', {
      method: 'POST',
      body: JSON.stringify(override),
    }),

  toggleTechnician: (id: string) =>
    request<{ user: User }>(`/technicians/${id}/toggle`, { method: 'POST' }),

  orgSeats: () =>
    request<{
      organizationId: string
      plan: string
      subscriptionStatus?: string
      used: number
      max: number | null
      trialDays: number | null
      trialEndsAt: string | null
      atLimit: boolean
      paywall?: boolean
      paymentsProvider?: string
    }>('/org/seats'),

  subscriptionPlans: () =>
    request<{
      currency: string
      methods: string[]
      paymentsProvider: string
      note: string
      plans: {
        id: string
        maxTechnicians: number | null
        priceSar: number | null
        labelEn: string
        checkoutEnabled: boolean
      }[]
    }>('/subscription/plans'),

  orgSubscription: () =>
    request<{
      organization: ProviderOrganization
      subscriptionStatus: string
      plan: string
      trialEndsAt: string | null
      trialActive: boolean
      paywall: boolean
      paymentsProvider: string
      methods: string[]
      checkoutPlans: { id: string; priceSar: number | null; labelEn: string; maxTechnicians: number | null }[]
      pendingCheckouts: {
        id: string
        planId: string
        amountSar: number
        provider: string
        checkoutUrl: string | null
        status: string
      }[]
    }>('/org/subscription'),

  startSubscriptionCheckout: (planId: string) =>
    request<{
      checkout: {
        id: string
        planId: string
        amountSar: number
        provider: string
        checkoutUrl: string | null
        status: string
      }
      methods: string[]
      paymentsProvider: string
      simulateAvailable: boolean
      note: string
    }>('/org/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    }),

  simulateSubscriptionCheckout: (checkoutId: string) =>
    request<{
      ok?: boolean
      alreadyPaid?: boolean
      organization: ProviderOrganization
      checkout: { id: string; status: string; planId: string }
    }>(`/org/subscription/checkout/${checkoutId}/simulate`, { method: 'POST' }),

  inviteTechnician: (data: {
    name: string
    nameAr?: string
    email: string
    phone: string
    password: string
    cityId?: string
    specialties?: ServiceCategoryId[]
  }) =>
    request<{ user: User; seats: { used: number; max: number | null } }>('/org/technicians', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  campaignSuggestions: () =>
    request<{
      suggestions: {
        id: string
        titleEn: string
        titleAr: string
        window: string
        offerIdea: string
        channel: string
        requiresApproval: boolean
      }[]
      note: string
    }>('/org/campaigns/suggestions'),
}
