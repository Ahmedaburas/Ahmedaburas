export type ServiceCategoryId = 'plumbing' | 'electrical'

export interface ProblemType {
  id: string
  labelEn: string
  labelAr: string
  baseFeeSar: number
}

export interface ServiceCategory {
  id: ServiceCategoryId
  labelEn: string
  labelAr: string
  descriptionEn: string
  descriptionAr: string
  icon: 'droplets' | 'zap'
  problems: ProblemType[]
}

/** Data-driven service catalog — add categories here for future expansion. */
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'plumbing',
    labelEn: 'Plumbing',
    labelAr: 'السباكة',
    descriptionEn: 'Leaks, drains, fixtures, heaters, and pipes',
    descriptionAr: 'التسريبات والمصارف والتركيبات والسخانات والأنابيب',
    icon: 'droplets',
    problems: [
      { id: 'water-leaks', labelEn: 'Water leaks', labelAr: 'تسربات المياه', baseFeeSar: 120 },
      { id: 'blocked-drains', labelEn: 'Blocked drains', labelAr: 'انسداد المصارف', baseFeeSar: 150 },
      { id: 'faucet-repair', labelEn: 'Faucet repair', labelAr: 'إصلاح الحنفيات', baseFeeSar: 100 },
      { id: 'toilet-repair', labelEn: 'Toilet repair', labelAr: 'إصلاح المرحاض', baseFeeSar: 130 },
      { id: 'water-heater', labelEn: 'Water heater repair', labelAr: 'إصلاح سخان المياه', baseFeeSar: 180 },
      { id: 'pipe-replacement', labelEn: 'Pipe replacement', labelAr: 'استبدال الأنابيب', baseFeeSar: 220 },
      { id: 'water-pressure', labelEn: 'Water pressure problems', labelAr: 'مشاكل ضغط المياه', baseFeeSar: 140 },
    ],
  },
  {
    id: 'electrical',
    labelEn: 'Electrical',
    labelAr: 'الكهرباء',
    descriptionEn: 'Outages, wiring, switches, lighting, and breakers',
    descriptionAr: 'انقطاع التيار والأسلاك والمفاتيح والإضاءة والقواطع',
    icon: 'zap',
    problems: [
      { id: 'power-outages', labelEn: 'Power outages', labelAr: 'انقطاع التيار', baseFeeSar: 150 },
      { id: 'electrical-faults', labelEn: 'Electrical faults', labelAr: 'أعطال كهربائية', baseFeeSar: 160 },
      { id: 'switch-socket', labelEn: 'Switch & socket replacement', labelAr: 'استبدال المفاتيح والمقابس', baseFeeSar: 110 },
      { id: 'lighting-install', labelEn: 'Lighting installation', labelAr: 'تركيب الإضاءة', baseFeeSar: 140 },
      { id: 'circuit-breaker', labelEn: 'Circuit breaker issues', labelAr: 'مشاكل قاطع الدائرة', baseFeeSar: 170 },
      { id: 'wiring-inspection', labelEn: 'Wiring inspection', labelAr: 'فحص الأسلاك', baseFeeSar: 200 },
      { id: 'electrical-troubleshoot', labelEn: 'Electrical troubleshooting', labelAr: 'تشخيص الأعطال الكهربائية', baseFeeSar: 180 },
    ],
  },
]

export function getCategory(id: ServiceCategoryId): ServiceCategory {
  const cat = SERVICE_CATEGORIES.find((c) => c.id === id)
  if (!cat) throw new Error(`Unknown category: ${id}`)
  return cat
}

export function getProblem(categoryId: ServiceCategoryId, problemId: string): ProblemType | undefined {
  return getCategory(categoryId).problems.find((p) => p.id === problemId)
}

export function getBaseFee(categoryId: ServiceCategoryId, problemId: string): number {
  return getProblem(categoryId, problemId)?.baseFeeSar ?? 150
}
