import { Languages } from 'lucide-react'
import { useStore } from '../store/store'
import { useI18n } from '../i18n'

export function LanguageSwitcher({ compact, light }: { compact?: boolean; light?: boolean }) {
  const { state, actions } = useStore()
  const { t } = useI18n()

  return (
    <button
      type="button"
      className={
        light
          ? 'inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-white/80 hover:bg-white/10'
          : 'btn-ghost'
      }
      onClick={() => actions.setLocale(state.locale === 'en' ? 'ar' : 'en')}
      aria-label={t('language')}
    >
      <Languages className="h-4 w-4" />
      {!compact && <span>{state.locale === 'en' ? t('arabic') : t('english')}</span>}
    </button>
  )
}
