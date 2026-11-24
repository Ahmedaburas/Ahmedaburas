import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'

export function Logo({ large }: { large?: boolean }) {
  const { t } = useI18n()
  return (
    <Link to="/" className="inline-flex min-w-0 items-center gap-2 no-underline sm:gap-2.5">
      <span
        className={`flex shrink-0 items-center justify-center rounded-xl bg-navy-900 text-teal-400 ${
          large ? 'h-11 w-11 sm:h-12 sm:w-12' : 'h-9 w-9'
        }`}
      >
        <svg viewBox="0 0 24 24" className={large ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-5 w-5'} fill="none">
          <path
            d="M4 16V9l8-6 8 6v7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 16v-5h6v5"
            stroke="#F8FAFC"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className={`truncate font-extrabold tracking-tight text-navy-900 ${
          large ? 'text-xl sm:text-2xl' : 'text-lg'
        }`}
      >
        {t('brand')}
      </span>
    </Link>
  )
}
