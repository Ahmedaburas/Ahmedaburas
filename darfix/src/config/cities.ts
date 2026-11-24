export interface District {
  id: string
  nameEn: string
  nameAr: string
}

export interface City {
  id: string
  nameEn: string
  nameAr: string
  /** Launch / expansion flag for GTM */
  tier: 'launch' | 'nearby' | 'expansion'
  districts: District[]
}

/** Primary launch market for DARFIX v1 */
export const LAUNCH_CITY_ID = 'jubail'

export const SAUDI_CITIES: City[] = [
  {
    id: 'jubail',
    nameEn: 'Jubail',
    nameAr: 'الجبيل',
    tier: 'launch',
    districts: [
      { id: 'fanateer', nameEn: 'Al Fanateer', nameAr: 'الفناتير' },
      { id: 'huwaylat', nameEn: 'Al Huwaylat', nameAr: 'الحويلات' },
      { id: 'balad', nameEn: 'Al Balad', nameAr: 'البلد' },
      { id: 'dafi', nameEn: 'Al Dafi', nameAr: 'الدفي' },
      { id: 'jalmudah', nameEn: 'Al Jalmudah', nameAr: 'الجلمودة' },
      { id: 'industrial', nameEn: 'Jubail Industrial City', nameAr: 'مدينة الجبيل الصناعية' },
      { id: 'bawadi', nameEn: 'Al Bawadi', nameAr: 'البوادي' },
    ],
  },
  {
    id: 'dammam',
    nameEn: 'Dammam',
    nameAr: 'الدمام',
    tier: 'nearby',
    districts: [
      { id: 'faisaliyah', nameEn: 'Al Faisaliyah', nameAr: 'الفيصلية' },
      { id: 'shati-d', nameEn: 'Ash Shati', nameAr: 'الشاطئ' },
      { id: 'jalawiyah', nameEn: 'Al Jalawiyah', nameAr: 'الجلوية' },
      { id: 'adamah', nameEn: 'Al Adamah', nameAr: 'العدامة' },
    ],
  },
  {
    id: 'khobar',
    nameEn: 'Al Khobar',
    nameAr: 'الخبر',
    tier: 'nearby',
    districts: [
      { id: 'thuqbah', nameEn: 'Ath Thuqbah', nameAr: 'الثقبة' },
      { id: 'olaya-k', nameEn: 'Olaya', nameAr: 'العليا' },
      { id: 'corniche', nameEn: 'Corniche', nameAr: 'الكورنيش' },
    ],
  },
  {
    id: 'riyadh',
    nameEn: 'Riyadh',
    nameAr: 'الرياض',
    tier: 'expansion',
    districts: [
      { id: 'olaya', nameEn: 'Olaya', nameAr: 'العليا' },
      { id: 'malaz', nameEn: 'Al Malaz', nameAr: 'الملز' },
      { id: 'narjis', nameEn: 'Al Narjis', nameAr: 'النرجس' },
      { id: 'yasmin', nameEn: 'Al Yasmin', nameAr: 'الياسمين' },
      { id: 'sulimaniyah', nameEn: 'Al Sulimaniyah', nameAr: 'السليمانية' },
      { id: 'rawdah', nameEn: 'Al Rawdah', nameAr: 'الروضة' },
    ],
  },
  {
    id: 'jeddah',
    nameEn: 'Jeddah',
    nameAr: 'جدة',
    tier: 'expansion',
    districts: [
      { id: 'hamra', nameEn: 'Al Hamra', nameAr: 'الحمراء' },
      { id: 'rawdah-j', nameEn: 'Al Rawdah', nameAr: 'الروضة' },
      { id: 'zahra', nameEn: 'Al Zahra', nameAr: 'الزهراء' },
      { id: 'shati', nameEn: 'Ash Shati', nameAr: 'الشاطئ' },
      { id: 'andalus', nameEn: 'Al Andalus', nameAr: 'الأندلس' },
    ],
  },
]

export function getCity(id: string): City | undefined {
  return SAUDI_CITIES.find((c) => c.id === id)
}

export function getDistrict(cityId: string, districtId: string): District | undefined {
  return getCity(cityId)?.districts.find((d) => d.id === districtId)
}

export function getLaunchCity(): City {
  return getCity(LAUNCH_CITY_ID)!
}

/** Cities shown first in pickers (launch + nearby Eastern Province). */
export function serviceAreaCities(): City[] {
  return [
    ...SAUDI_CITIES.filter((c) => c.tier === 'launch'),
    ...SAUDI_CITIES.filter((c) => c.tier === 'nearby'),
    ...SAUDI_CITIES.filter((c) => c.tier === 'expansion'),
  ]
}

export function formatPhone966(local: string): string {
  const digits = local.replace(/\D/g, '')
  if (digits.startsWith('966')) return `+${digits}`
  if (digits.startsWith('0')) return `+966${digits.slice(1)}`
  if (digits.startsWith('5')) return `+966${digits}`
  return `+966${digits}`
}
