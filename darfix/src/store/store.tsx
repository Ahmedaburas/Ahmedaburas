import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getBaseFee, type ServiceCategoryId } from '../config/services'
import { notificationService } from '../adapters/notifications'
import { paymentService } from '../adapters/payments'
import { mapsService } from '../adapters/maps'
import { createSeedState, DEMO_PASSWORD } from './seed'
import type {
  AppNotification,
  AppState,
  Booking,
  BookingAddress,
  BookingStatus,
  CostLine,
  DiscountCode,
  ExtraWorkRequest,
  Invoice,
  JobPhoto,
  PricingOverride,
  Quotation,
  User,
  UserRole,
} from './types'

const STORAGE_KEY = 'darfix_state_v1'

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed?.users?.length) return parsed
    }
  } catch {
    /* ignore */
  }
  return createSeedState()
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

interface StoreActions {
  login: (email: string, password: string) => User | null
  logout: () => void
  signup: (data: {
    name: string
    nameAr?: string
    email: string
    phone: string
    password: string
    cityId?: string
    districtId?: string
  }) => User | { error: string }
  setLocale: (locale: 'en' | 'ar') => void
  resetDemoData: () => void

  createBooking: (input: {
    categoryId: ServiceCategoryId
    problemId: string
    description: string
    photos: JobPhoto[]
    address: BookingAddress
    preferredDate: string
    preferredTimeSlot: string
    discountCode?: string
  }) => Booking
  updateBookingStatus: (bookingId: string, status: BookingStatus, note?: string) => void
  assignTechnician: (bookingId: string, technicianId: string) => void
  addBookingPhotos: (bookingId: string, photos: JobPhoto[]) => void
  addCosts: (bookingId: string, costs: CostLine[]) => void
  submitJobReport: (bookingId: string, report: string) => void
  requestExtraWork: (bookingId: string, description: string, amountSar: number) => void
  respondExtraWork: (bookingId: string, extraId: string, approve: boolean) => void
  rateBooking: (bookingId: string, rating: number, reviewText: string) => void
  cancelBooking: (bookingId: string) => void

  markNotificationRead: (id: string) => void
  markAllNotificationsRead: (userId: string) => void

  upsertDiscount: (code: DiscountCode) => void
  toggleDiscount: (id: string) => void
  setPricingOverride: (override: PricingOverride) => void
  toggleTechnician: (techId: string) => void

  createQuotation: (bookingId: string, lines: CostLine[]) => Quotation
  payInvoice: (invoiceId: string) => Promise<Invoice>
  getEffectiveFee: (categoryId: ServiceCategoryId, problemId: string) => number
}

interface StoreContextValue {
  state: AppState
  currentUser: User | null
  actions: StoreActions
}

const StoreContext = createContext<StoreContextValue | null>(null)

function pushNotification(
  state: AppState,
  n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>,
): AppState {
  const notification: AppNotification = {
    ...n,
    id: uid('n'),
    read: false,
    createdAt: new Date().toISOString(),
  }
  void notificationService.send({
    channel: 'in_app',
    to: n.userId,
    templateId: n.type,
    payload: { title: n.titleEn, body: n.bodyEn },
  })
  return { ...state, notifications: [notification, ...state.notifications] }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    document.documentElement.lang = state.locale
    document.documentElement.dir = state.locale === 'ar' ? 'rtl' : 'ltr'
  }, [state.locale])

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.sessionUserId) ?? null,
    [state.users, state.sessionUserId],
  )

  const getEffectiveFee = useCallback(
    (categoryId: ServiceCategoryId, problemId: string) => {
      const override = state.pricingOverrides.find(
        (p) => p.categoryId === categoryId && p.problemId === problemId,
      )
      return override?.baseFeeSar ?? getBaseFee(categoryId, problemId)
    },
    [state.pricingOverrides],
  )

  const actions: StoreActions = useMemo(() => {
    const login = (email: string, password: string) => {
      const user = state.users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
      )
      if (!user) return null
      setState((s) => ({ ...s, sessionUserId: user.id }))
      return user
    }

    const logout = () => setState((s) => ({ ...s, sessionUserId: null }))

    const signup = (data: {
      name: string
      nameAr?: string
      email: string
      phone: string
      password: string
      cityId?: string
      districtId?: string
    }) => {
      if (state.users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
        return { error: 'Email already registered' }
      }
      const user: User = {
        id: uid('cust'),
        role: 'customer',
        name: data.name,
        nameAr: data.nameAr || data.name,
        email: data.email,
        phone: data.phone.startsWith('+') ? data.phone : `+966${data.phone.replace(/^0/, '')}`,
        password: data.password,
        cityId: data.cityId,
        districtId: data.districtId,
        avatarColor: '#14B8A6',
      }
      setState((s) => ({ ...s, users: [...s.users, user], sessionUserId: user.id }))
      return user
    }

    const setLocale = (locale: 'en' | 'ar') => setState((s) => ({ ...s, locale }))

    const resetDemoData = () => {
      const fresh = createSeedState()
      fresh.locale = state.locale
      setState(fresh)
    }

    const createBooking = (input: {
      categoryId: ServiceCategoryId
      problemId: string
      description: string
      photos: JobPhoto[]
      address: BookingAddress
      preferredDate: string
      preferredTimeSlot: string
      discountCode?: string
    }) => {
      if (!state.sessionUserId) throw new Error('Not logged in')
      let fee = getEffectiveFee(input.categoryId, input.problemId)
      let discountAmount = 0
      let usedCode: string | undefined

      if (input.discountCode) {
        const dc = state.discountCodes.find(
          (d) => d.code.toUpperCase() === input.discountCode!.toUpperCase() && d.active,
        )
        if (dc && dc.usedCount < dc.maxUses) {
          discountAmount = Math.round((fee * dc.percentOff) / 100)
          fee -= discountAmount
          usedCode = dc.code
        }
      }

      const booking: Booking = {
        id: uid('bk'),
        customerId: state.sessionUserId,
        categoryId: input.categoryId,
        problemId: input.problemId,
        description: input.description,
        photos: input.photos,
        address: input.address,
        preferredDate: input.preferredDate,
        preferredTimeSlot: input.preferredTimeSlot,
        estimatedFeeSar: fee,
        status: 'new_request',
        costs: [
          { id: uid('cost'), label: 'Service call', amountSar: fee + discountAmount, type: 'fee' },
          ...(discountAmount
            ? [{ id: uid('cost'), label: `Discount (${usedCode})`, amountSar: -discountAmount, type: 'discount' as const }]
            : []),
        ],
        extraWork: [],
        discountCode: usedCode,
        discountAmountSar: discountAmount || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        statusHistory: [{ status: 'new_request', at: new Date().toISOString() }],
      }

      setState((s) => {
        let next = {
          ...s,
          bookings: [booking, ...s.bookings],
          discountCodes: usedCode
            ? s.discountCodes.map((d) =>
                d.code === usedCode ? { ...d, usedCount: d.usedCount + 1 } : d,
              )
            : s.discountCodes,
        }
        next = pushNotification(next, {
          userId: booking.customerId,
          type: 'booking_confirmed',
          titleEn: 'Booking submitted',
          titleAr: 'تم إرسال الحجز',
          bodyEn: `Your ${booking.categoryId} request ${booking.id} was received.`,
          bodyAr: `تم استلام طلب ${booking.categoryId === 'plumbing' ? 'السباكة' : 'الكهرباء'} ${booking.id}.`,
          bookingId: booking.id,
        })
        const admins = s.users.filter((u) => u.role === 'admin')
        for (const admin of admins) {
          next = pushNotification(next, {
            userId: admin.id,
            type: 'general',
            titleEn: 'New booking request',
            titleAr: 'طلب حجز جديد',
            bodyEn: `New ${booking.categoryId} booking ${booking.id}`,
            bodyAr: `حجز جديد ${booking.id}`,
            bookingId: booking.id,
          })
        }
        return next
      })

      void mapsService.geocode(
        `${input.address.street} ${input.address.cityId} ${input.address.districtId}`,
      )

      return booking
    }

    const updateBookingStatus = (bookingId: string, status: BookingStatus, note?: string) => {
      setState((s) => {
        const booking = s.bookings.find((b) => b.id === bookingId)
        if (!booking) return s
        let next: AppState = {
          ...s,
          bookings: s.bookings.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  status,
                  updatedAt: new Date().toISOString(),
                  statusHistory: [
                    ...b.statusHistory,
                    {
                      status,
                      at: new Date().toISOString(),
                      by: s.sessionUserId ?? undefined,
                      note,
                    },
                  ],
                }
              : b,
          ),
        }

        const notifyMap: Partial<
          Record<BookingStatus, { type: AppNotification['type']; titleEn: string; titleAr: string; bodyEn: string; bodyAr: string }>
        > = {
          confirmed: {
            type: 'booking_confirmed',
            titleEn: 'Booking confirmed',
            titleAr: 'تم تأكيد الحجز',
            bodyEn: `Booking ${bookingId} is confirmed.`,
            bodyAr: `تم تأكيد الحجز ${bookingId}.`,
          },
          on_the_way: {
            type: 'on_the_way',
            titleEn: 'Technician on the way',
            titleAr: 'الفني في الطريق',
            bodyEn: `Your technician is heading to you for ${bookingId}.`,
            bodyAr: `الفني في الطريق إليك للحجز ${bookingId}.`,
          },
          completed: {
            type: 'job_completed',
            titleEn: 'Job completed',
            titleAr: 'اكتملت المهمة',
            bodyEn: `Booking ${bookingId} is complete. Please rate your experience.`,
            bodyAr: `اكتمل الحجز ${bookingId}. يرجى تقييم تجربتك.`,
          },
        }

        const msg = notifyMap[status]
        if (msg) {
          next = pushNotification(next, {
            userId: booking.customerId,
            ...msg,
            bookingId,
          })
        }

        if (status === 'completed') {
          const updated = next.bookings.find((b) => b.id === bookingId)!
          const total = updated.costs.reduce((sum, c) => sum + c.amountSar, 0)
          const invoice: Invoice = {
            id: uid('inv'),
            bookingId,
            customerId: booking.customerId,
            lines: updated.costs,
            totalSar: total,
            status: 'unpaid',
            createdAt: new Date().toISOString(),
          }
          next = { ...next, invoices: [invoice, ...next.invoices] }
        }

        return next
      })
    }

    const assignTechnician = (bookingId: string, technicianId: string) => {
      setState((s) => {
        const booking = s.bookings.find((b) => b.id === bookingId)
        const tech = s.users.find((u) => u.id === technicianId)
        if (!booking || !tech) return s
        let next: AppState = {
          ...s,
          bookings: s.bookings.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  technicianId,
                  status: 'technician_assigned' as BookingStatus,
                  updatedAt: new Date().toISOString(),
                  statusHistory: [
                    ...b.statusHistory,
                    {
                      status: 'technician_assigned' as BookingStatus,
                      at: new Date().toISOString(),
                      by: s.sessionUserId ?? undefined,
                    },
                  ],
                }
              : b,
          ),
        }
        next = pushNotification(next, {
          userId: booking.customerId,
          type: 'technician_assigned',
          titleEn: 'Technician assigned',
          titleAr: 'تم تعيين فني',
          bodyEn: `${tech.name} has been assigned to booking ${bookingId}.`,
          bodyAr: `تم تعيين ${tech.nameAr} للحجز ${bookingId}.`,
          bookingId,
        })
        next = pushNotification(next, {
          userId: technicianId,
          type: 'general',
          titleEn: 'New job assigned',
          titleAr: 'مهمة جديدة',
          bodyEn: `You were assigned booking ${bookingId}.`,
          bodyAr: `تم تعيين الحجز ${bookingId} لك.`,
          bookingId,
        })
        return next
      })
    }

    const addBookingPhotos = (bookingId: string, photos: JobPhoto[]) => {
      setState((s) => ({
        ...s,
        bookings: s.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, photos: [...b.photos, ...photos], updatedAt: new Date().toISOString() }
            : b,
        ),
      }))
    }

    const addCosts = (bookingId: string, costs: CostLine[]) => {
      setState((s) => ({
        ...s,
        bookings: s.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, costs: [...b.costs, ...costs], updatedAt: new Date().toISOString() }
            : b,
        ),
      }))
    }

    const submitJobReport = (bookingId: string, report: string) => {
      setState((s) => ({
        ...s,
        bookings: s.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, jobReport: report, updatedAt: new Date().toISOString() }
            : b,
        ),
      }))
      updateBookingStatus(bookingId, 'completed')
    }

    const requestExtraWork = (bookingId: string, description: string, amountSar: number) => {
      const extra: ExtraWorkRequest = {
        id: uid('ew'),
        description,
        amountSar,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      setState((s) => {
        const booking = s.bookings.find((b) => b.id === bookingId)
        if (!booking) return s
        let next: AppState = {
          ...s,
          bookings: s.bookings.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  extraWork: [...b.extraWork, extra],
                  status: 'awaiting_approval',
                  updatedAt: new Date().toISOString(),
                  statusHistory: [
                    ...b.statusHistory,
                    {
                      status: 'awaiting_approval' as BookingStatus,
                      at: new Date().toISOString(),
                      by: s.sessionUserId ?? undefined,
                    },
                  ],
                }
              : b,
          ),
        }
        next = pushNotification(next, {
          userId: booking.customerId,
          type: 'extra_work',
          titleEn: 'Extra work approval needed',
          titleAr: 'مطلوب الموافقة على عمل إضافي',
          bodyEn: `Approve additional work: ${description} (SAR ${amountSar})`,
          bodyAr: `وافق على عمل إضافي: ${description} (${amountSar} ر.س)`,
          bookingId,
        })
        return next
      })
    }

    const respondExtraWork = (bookingId: string, extraId: string, approve: boolean) => {
      setState((s) => {
        const booking = s.bookings.find((b) => b.id === bookingId)
        if (!booking) return s
        return {
          ...s,
          bookings: s.bookings.map((b) => {
            if (b.id !== bookingId) return b
            const extraWork = b.extraWork.map((e) =>
              e.id === extraId ? { ...e, status: approve ? ('approved' as const) : ('rejected' as const) } : e,
            )
            const costs = approve
              ? [
                  ...b.costs,
                  {
                    id: uid('cost'),
                    label: b.extraWork.find((e) => e.id === extraId)?.description ?? 'Extra work',
                    amountSar: b.extraWork.find((e) => e.id === extraId)?.amountSar ?? 0,
                    type: 'materials' as const,
                  },
                ]
              : b.costs
            return {
              ...b,
              extraWork,
              costs,
              status: 'in_progress' as BookingStatus,
              updatedAt: new Date().toISOString(),
            }
          }),
        }
      })
    }

    const rateBooking = (bookingId: string, rating: number, reviewText: string) => {
      setState((s) => {
        const booking = s.bookings.find((b) => b.id === bookingId)
        if (!booking?.technicianId) return s
        const tech = s.users.find((u) => u.id === booking.technicianId)
        const users = s.users.map((u) => {
          if (u.id !== booking.technicianId) return u
          const count = (u.reviewCount ?? 0) + 1
          const prev = (u.rating ?? 0) * (u.reviewCount ?? 0)
          return { ...u, reviewCount: count, rating: Math.round(((prev + rating) / count) * 10) / 10 }
        })
        void tech
        return {
          ...s,
          users,
          bookings: s.bookings.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  rating,
                  reviewText,
                  reviewedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : b,
          ),
        }
      })
    }

    const cancelBooking = (bookingId: string) => updateBookingStatus(bookingId, 'cancelled')

    const markNotificationRead = (id: string) => {
      setState((s) => ({
        ...s,
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }))
    }

    const markAllNotificationsRead = (userId: string) => {
      setState((s) => ({
        ...s,
        notifications: s.notifications.map((n) =>
          n.userId === userId ? { ...n, read: true } : n,
        ),
      }))
    }

    const upsertDiscount = (code: DiscountCode) => {
      setState((s) => {
        const exists = s.discountCodes.some((d) => d.id === code.id)
        return {
          ...s,
          discountCodes: exists
            ? s.discountCodes.map((d) => (d.id === code.id ? code : d))
            : [...s.discountCodes, code],
        }
      })
    }

    const toggleDiscount = (id: string) => {
      setState((s) => ({
        ...s,
        discountCodes: s.discountCodes.map((d) =>
          d.id === id ? { ...d, active: !d.active } : d,
        ),
      }))
    }

    const setPricingOverride = (override: PricingOverride) => {
      setState((s) => {
        const exists = s.pricingOverrides.some(
          (p) => p.categoryId === override.categoryId && p.problemId === override.problemId,
        )
        return {
          ...s,
          pricingOverrides: exists
            ? s.pricingOverrides.map((p) =>
                p.categoryId === override.categoryId && p.problemId === override.problemId
                  ? override
                  : p,
              )
            : [...s.pricingOverrides, override],
        }
      })
    }

    const toggleTechnician = (techId: string) => {
      setState((s) => ({
        ...s,
        users: s.users.map((u) =>
          u.id === techId ? { ...u, active: !(u.active ?? true) } : u,
        ),
      }))
    }

    const createQuotation = (bookingId: string, lines: CostLine[]) => {
      const quotation: Quotation = {
        id: uid('q'),
        bookingId,
        lines,
        totalSar: lines.reduce((s, l) => s + l.amountSar, 0),
        status: 'sent',
        createdAt: new Date().toISOString(),
      }
      setState((s) => {
        const booking = s.bookings.find((b) => b.id === bookingId)
        let next: AppState = { ...s, quotations: [quotation, ...s.quotations] }
        if (booking) {
          next = pushNotification(next, {
            userId: booking.customerId,
            type: 'quotation',
            titleEn: 'New quotation',
            titleAr: 'عرض سعر جديد',
            bodyEn: `Quotation for ${bookingId}: SAR ${quotation.totalSar}`,
            bodyAr: `عرض سعر للحجز ${bookingId}: ${quotation.totalSar} ر.س`,
            bookingId,
          })
        }
        return next
      })
      return quotation
    }

    const payInvoice = async (invoiceId: string) => {
      const invoice = state.invoices.find((i) => i.id === invoiceId)
      if (!invoice) throw new Error('Invoice not found')
      const intent = await paymentService.createIntent(invoiceId, invoice.totalSar)
      await paymentService.confirmPayment(intent.id)
      const paid: Invoice = {
        ...invoice,
        status: 'paid',
        paidAt: new Date().toISOString(),
      }
      setState((s) => ({
        ...s,
        invoices: s.invoices.map((i) => (i.id === invoiceId ? paid : i)),
      }))
      return paid
    }

    return {
      login,
      logout,
      signup,
      setLocale,
      resetDemoData,
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
  }, [state, getEffectiveFee])

  const value = useMemo(
    () => ({ state, currentUser, actions }),
    [state, currentUser, actions],
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
