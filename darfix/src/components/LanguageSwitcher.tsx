import { Languages } from 'lucide-react'
import { useStore } from '../store/store'
import { useI18n } from '../i18n'

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { state, actions } = useStore()
  const { t } = useI18n()

  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={() => actions.setLocale(state.locale === 'en' ? 'ar' : 'en')}
      aria-label={t('language')}
    >
      <Languages className="h-4 w-4" />
      {!compact && <span>{state.locale === 'en' ? t('arabic') : t('english')}</span>}
    </button>
  )
}
