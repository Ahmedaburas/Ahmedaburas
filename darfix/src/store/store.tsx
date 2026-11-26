import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, getStoredLocale, getToken, setStoredLocale, setToken } from '../api/client'
import type { ServiceCategoryId } from '../config/services'
import { DEMO_PASSWORD } from './seed'
import type {
  AppState,
  Booking,
  BookingAddress,
  BookingStatus,
  CostLine,
  DiscountCode,
  Invoice,
  JobPhoto,
  PricingOverride,
  Quotation,
  User,
  UserRole,
} from './types'

const emptyState = (locale: 'en' | 'ar' = 'en'): AppState => ({
  users: [],
  bookings: [],
  notifications: [],
  quotations: [],
  invoices: [],
  discountCodes: [],
  pricingOverrides: [],
  organizations: [],
  organizationMembers: [],
  leadOffers: [],
  sessionUserId: null,
  locale,
})

interface StoreActions {
  login: (email: string, password: string) => Promise<User | null>
  logout: () => Promise<void>
  signup: (data: {
    name: string
    nameAr?: string
    email: string
    phone: string
    password: string
    cityId?: string
    districtId?: string
  }) => Promise<User | { error: string }>
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
  }) => Promise<User | { error: string }>
  inviteTechnician: (data: {
    name: string
    email: string
    phone: string
    password: string
    cityId?: string
    specialties?: ServiceCategoryId[]
  }) => Promise<{ user: User; seats: { used: number; max: number | null } } | { error: string }>
  setLocale: (locale: 'en' | 'ar') => void
  resetDemoData: () => Promise<void>
  refresh: () => Promise<void>

  createBooking: (input: {
    categoryId: ServiceCategoryId
    problemId: string
    description: string
    photos: JobPhoto[]
    address: BookingAddress
    preferredDate: string
    preferredTimeSlot: string
    discountCode?: string
    preferredOrganizationId?: string
  }) => Promise<Booking>
  updateBookingStatus: (bookingId: string, status: BookingStatus, note?: string) => Promise<void>
  assignTechnician: (
    bookingId: string,
    technicianId?: string,
    organizationId?: string,
  ) => Promise<void>
  addBookingPhotos: (bookingId: string, photos: JobPhoto[]) => Promise<void>
  addCosts: (bookingId: string, costs: CostLine[]) => Promise<void>
  submitJobReport: (bookingId: string, report: string) => Promise<void>
  requestExtraWork: (bookingId: string, description: string, amountSar: number) => Promise<void>
  respondExtraWork: (bookingId: string, extraId: string, approve: boolean) => Promise<void>
  rateBooking: (bookingId: string, rating: number, reviewText: string) => Promise<void>
  cancelBooking: (bookingId: string) => Promise<void>
  addProcessNote: (bookingId: string, text: string) => Promise<void>
  toggleChecklist: (bookingId: string, itemId: string, done: boolean) => Promise<void>
  respondLeadOffer: (offerId: string, accept: boolean) => Promise<void>
  reviewQuotation: (
    quotationId: string,
    decision: 'approve' | 'reject' | 'clarify',
    note?: string,
  ) => Promise<void>
  respondQuotation: (quotationId: string, approve: boolean) => Promise<void>
  techRespond: (bookingId: string, accept: boolean) => Promise<void>
  setGpsSharing: (bookingId: string, active: boolean, lat?: number, lng?: number) => Promise<void>

  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: (userId: string) => Promise<void>

  upsertDiscount: (code: DiscountCode) => Promise<void>
  toggleDiscount: (id: string) => Promise<void>
  setPricingOverride: (override: PricingOverride) => Promise<void>
  toggleTechnician: (techId: string) => Promise<void>

  createQuotation: (bookingId: string, lines: CostLine[]) => Promise<Quotation>
  payInvoice: (invoiceId: string) => Promise<Invoice>
  getEffectiveFee: (categoryId: ServiceCategoryId, problemId: string) => number
}

interface StoreContextValue {
  state: AppState
  currentUser: User | null
  loading: boolean
  actions: StoreActions
}

const StoreContext = createContext<StoreContextValue | null>(null)

function upsertBooking(bookings: Booking[], booking: Booking) {
  const idx = bookings.findIndex((b) => b.id === booking.id)
  if (idx === -1) return [booking, ...bookings]
  const next = [...bookings]
  next[idx] = booking
  return next
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => emptyState(getStoredLocale()))
  const [loading, setLoading] = useState(true)
  const [feeCache, setFeeCache] = useState<Record<string, number>>({})

  const refresh = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setState((s) => ({ ...emptyState(s.locale), locale: s.locale }))
      setLoading(false)
      return
    }
    try {
      const locale = getStoredLocale()
      const data = await api.bootstrap(locale)
      setState({ ...data, locale })
    } catch {
      setToken(null)
      setState((s) => ({ ...emptyState(s.locale), locale: s.locale }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    document.documentElement.lang = state.locale
    document.documentElement.dir = state.locale === 'ar' ? 'rtl' : 'ltr'
  }, [state.locale])

  // Poll for shared-state updates across roles while logged in
  useEffect(() => {
    if (!state.sessionUserId) return
    const id = window.setInterval(() => {
      void refresh()
    }, 8000)
    return () => window.clearInterval(id)
  }, [state.sessionUserId, refresh])

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.sessionUserId) ?? null,
    [state.users, state.sessionUserId],
  )

  const getEffectiveFee = useCallback(
    (categoryId: ServiceCategoryId, problemId: string) => {
      const key = `${categoryId}:${problemId}`
      const override = state.pricingOverrides.find(
        (p) => p.categoryId === categoryId && p.problemId === problemId,
      )
      if (override) return override.baseFeeSar
      if (feeCache[key] != null) return feeCache[key]
      void api.getFee(categoryId, problemId).then((r) => {
        setFeeCache((c) => ({ ...c, [key]: r.baseFeeSar }))
      })
      // sensible defaults while fetching
      const defaults: Record<string, number> = {
        'plumbing:water-leaks': 120,
        'plumbing:blocked-drains': 150,
        'plumbing:faucet-repair': 100,
        'plumbing:toilet-repair': 130,
        'plumbing:water-heater': 180,
        'plumbing:pipe-replacement': 220,
        'plumbing:water-pressure': 140,
        'electrical:power-outages': 150,
        'electrical:electrical-faults': 160,
        'electrical:switch-socket': 110,
        'electrical:lighting-install': 140,
        'electrical:circuit-breaker': 170,
        'electrical:wiring-inspection': 200,
        'electrical:electrical-troubleshoot': 180,
      }
      return defaults[key] ?? 150
    },
    [state.pricingOverrides, feeCache],
  )

  const actions: StoreActions = useMemo(() => {
    const login = async (email: string, password: string) => {
      try {
        const { token, user } = await api.login(email, password)
        setToken(token)
        await refresh()
        return user
      } catch {
        return null
      }
    }

    const logout = async () => {
      try {
        await api.logout()
      } catch {
        /* ignore */
      }
      setToken(null)
      setState((s) => ({ ...emptyState(s.locale), locale: s.locale }))
    }

    const signup = async (data: {
      name: string
      nameAr?: string
      email: string
      phone: string
      password: string
      cityId?: string
      districtId?: string
    }) => {
      try {
        const { token, user } = await api.signup(data)
        setToken(token)
        await refresh()
        return user
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Signup failed' }
      }
    }

    const signupProvider = async (data: {
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
    }) => {
      try {
        const { token, user } = await api.signupProvider(data)
        setToken(token)
        await refresh()
        return user
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Signup failed' }
      }
    }

    const inviteTechnician = async (data: {
      name: string
      email: string
      phone: string
      password: string
      cityId?: string
      specialties?: ServiceCategoryId[]
    }) => {
      try {
        const result = await api.inviteTechnician(data)
        await refresh()
        return result
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Invite failed' }
      }
    }

    const setLocale = (locale: 'en' | 'ar') => {
      setStoredLocale(locale)
      setState((s) => ({ ...s, locale }))
      document.documentElement.lang = locale
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
    }

    const resetDemoData = async () => {
      const { token, state: next } = await api.resetDemo()
      setToken(token)
      setState({ ...next, locale: state.locale })
    }

    const createBooking = async (input: {
      categoryId: ServiceCategoryId
      problemId: string
      description: string
      photos: JobPhoto[]
      address: BookingAddress
      preferredDate: string
      preferredTimeSlot: string
      discountCode?: string
      preferredOrganizationId?: string
    }) => {
      const { booking } = await api.createBooking(input)
      await refresh()
      return booking
    }

    const updateBookingStatus = async (
      bookingId: string,
      status: BookingStatus,
      note?: string,
    ) => {
      const { booking } = await api.updateStatus(bookingId, status, note)
      setState((s) => ({ ...s, bookings: upsertBooking(s.bookings, booking) }))
      await refresh()
    }

    const assignTechnician = async (
      bookingId: string,
      technicianId?: string,
      organizationId?: string,
    ) => {
      const { booking } = await api.assignTechnician(bookingId, technicianId, organizationId)
      setState((s) => ({ ...s, bookings: upsertBooking(s.bookings, booking) }))
      await refresh()
    }

    const addBookingPhotos = async (bookingId: string, photos: JobPhoto[]) => {
      const { booking } = await api.addPhotos(bookingId, photos)
      setState((s) => ({ ...s, bookings: upsertBooking(s.bookings, booking) }))
    }

    const addCosts = async (bookingId: string, costs: CostLine[]) => {
      const { booking } = await api.addCosts(bookingId, costs)
      setState((s) => ({ ...s, bookings: upsertBooking(s.bookings, booking) }))
    }

    const submitJobReport = async (bookingId: string, report: string) => {
      const { booking } = await api.submitReport(bookingId, report)
      setState((s) => ({ ...s, bookings: upsertBooking(s.bookings, booking) }))
      await refresh()
    }

    const requestExtraWork = async (
      bookingId: string,
      description: string,
      amountSar: number,
    ) => {
      const { booking } = await api.requestExtraWork(bookingId, description, amountSar)
      setState((s) => ({ ...s, bookings: upsertBooking(s.bookings, booking) }))
      await refresh()
    }

    const respondExtraWork = async (bookingId: string, extraId: string, approve: boolean) => {
      const { booking } = await api.respondExtraWork(bookingId, extraId, approve)
      setState((s) => ({ ...s, bookings: upsertBooking(s.bookings, booking) }))
      await refresh()
    }

    const rateBooking = async (bookingId: string, rating: number, reviewText: string) => {
      const { booking } = await api.rateBooking(bookingId, rating, reviewText)
      setState((s) => ({ ...s, bookings: upsertBooking(s.bookings, booking) }))
      await refresh()
    }

    const cancelBooking = async (bookingId: string) => {
      await updateBookingStatus(bookingId, 'cancelled')
    }

    const addProcessNote = async (bookingId: string, text: string) => {
      const { booking } = await api.addProcessNote(bookingId, text)
      setState((s) => ({ ...s, bookings: upsertBooking(s.bookings, booking) }))
    }

    const toggleChecklist = async (bookingId: string, itemId: string, done: boolean) => {
      const { booking } = await api.toggleChecklist(bookingId, itemId, done)
      setState((s) => ({ ...s, bookings: upsertBooking(s.bookings, booking) }))
    }

    const markNotificationRead = async (id: string) => {
      await api.markNotificationRead(id)
      setState((s) => ({
        ...s,
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }))
    }

    const markAllNotificationsRead = async (_userId: string) => {
      await api.markAllNotificationsRead()
      setState((s) => ({
        ...s,
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
      }))
    }

    const upsertDiscount = async (code: DiscountCode) => {
      await api.upsertDiscount(code)
      await refresh()
    }

    const toggleDiscount = async (id: string) => {
      await api.toggleDiscount(id)
      await refresh()
    }

    const setPricingOverride = async (override: PricingOverride) => {
      await api.setPricing(override)
      await refresh()
    }

    const toggleTechnician = async (techId: string) => {
      await api.toggleTechnician(techId)
      await refresh()
    }

    const createQuotation = async (bookingId: string, lines: CostLine[]) => {
      const { quotation } = await api.createQuotation(bookingId, lines)
      await refresh()
      return quotation
    }

    const respondLeadOffer = async (offerId: string, accept: boolean) => {
      await api.respondLeadOffer(offerId, accept)
      await refresh()
    }

    const reviewQuotation = async (
      quotationId: string,
      decision: 'approve' | 'reject' | 'clarify',
      note?: string,
    ) => {
      await api.reviewQuotation(quotationId, decision, note)
      await refresh()
    }

    const respondQuotation = async (quotationId: string, approve: boolean) => {
      await api.respondQuotation(quotationId, approve)
      await refresh()
    }

    const techRespond = async (bookingId: string, accept: boolean) => {
      const { booking } = await api.techRespond(bookingId, accept)
      setState((s) => ({ ...s, bookings: upsertBooking(s.bookings, booking) }))
      await refresh()
    }

    const setGpsSharing = async (
      bookingId: string,
      active: boolean,
      lat?: number,
      lng?: number,
    ) => {
      const { booking } = await api.setGpsSharing(bookingId, active, lat, lng)
      setState((s) => ({ ...s, bookings: upsertBooking(s.bookings, booking) }))
    }

    const payInvoice = async (invoiceId: string) => {
      const { invoice } = await api.payInvoice(invoiceId)
      await refresh()
      return invoice
    }

    return {
      login,
      logout,
      signup,
      signupProvider,
      inviteTechnician,
      setLocale,
      resetDemoData,
      refresh,
      createBooking,
      updateBookingStatus,
      assignTechnician,
      addBookingPhotos,
      addCosts,
      submitJobReport,
      requestExtraWork,
      respondExtraWork,
      rateBooking,
      cancelBooking,
      addProcessNote,
      toggleChecklist,
      respondLeadOffer,
      reviewQuotation,
      respondQuotation,
      techRespond,
      setGpsSharing,
      markNotificationRead,
      markAllNotificationsRead,
      upsertDiscount,
      toggleDiscount,
      setPricingOverride,
      toggleTechnician,
      createQuotation,
      payInvoice,
      getEffectiveFee,
    }
  }, [refresh, getEffectiveFee, state.locale])

  const value = useMemo(
    () => ({ state, currentUser, loading, actions }),
    [state, currentUser, loading, actions],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export function useUsersByRole(role: UserRole) {
  const { state } = useStore()
  return state.users.filter((u) => u.role === role)
}

export { DEMO_PASSWORD }
