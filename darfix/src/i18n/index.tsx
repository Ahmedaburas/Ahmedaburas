import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useStore } from '../store/store'
import { dictionaries, statusLabels, type Locale } from './translations'
import type { BookingStatus } from '../store/types'
import { getCategory, getProblem, type ServiceCategoryId } from '../config/services'
import { getCity, getDistrict } from '../config/cities'
import { TIME_SLOTS } from '../store/types'

interface I18nValue {
  locale: Locale
  t: (key: string) => string
  statusLabel: (status: BookingStatus) => string
  categoryLabel: (id: ServiceCategoryId) => string
  problemLabel: (categoryId: ServiceCategoryId, problemId: string) => string
  cityLabel: (cityId: string) => string
  districtLabel: (cityId: string, districtId: string) => string
  timeSlotLabel: (slotId: string) => string
  formatSar: (amount: number) => string
  displayName: (name: string, nameAr: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const { state } = useStore()
  const locale = state.locale

  const value = useMemo<I18nValue>(() => {
    const dict = dictionaries[locale]
    return {
      locale,
      t: (key) => dict[key] ?? key,
      statusLabel: (status) => statusLabels[status][locale],
      categoryLabel: (id) => {
        const c = getCategory(id)
        return locale === 'ar' ? c.labelAr : c.labelEn
      },
      problemLabel: (categoryId, problemId) => {
        const p = getProblem(categoryId, problemId)
        if (!p) return problemId
        return locale === 'ar' ? p.labelAr : p.labelEn
      },
      cityLabel: (cityId) => {
        const c = getCity(cityId)
        if (!c) return cityId
        return locale === 'ar' ? c.nameAr : c.nameEn
      },
      districtLabel: (cityId, districtId) => {
        const d = getDistrict(cityId, districtId)
        if (!d) return districtId
        return locale === 'ar' ? d.nameAr : d.nameEn
      },
      timeSlotLabel: (slotId) => {
        const slot = TIME_SLOTS.find((s) => s.id === slotId)
        if (!slot) return slotId
        return locale === 'ar' ? slot.labelAr : slot.labelEn
      },
      formatSar: (amount) =>
        locale === 'ar'
          ? `${amount.toLocaleString('ar-SA')} ر.س`
          : `SAR ${amount.toLocaleString('en-SA')}`,
      displayName: (name, nameAr) => (locale === 'ar' ? nameAr : name),
    }
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
