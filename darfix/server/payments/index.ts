import { MockPaymentProvider } from './mock'
import { MoyasarPaymentProvider } from './moyasar'
import type { PaymentProvider, PaymentProviderName } from './types'

export type { PaymentProvider, PaymentProviderName } from './types'
export type {
  CheckoutStatus,
  CreateSubscriptionCheckoutInput,
  CreateSubscriptionCheckoutResult,
} from './types'
export { sarToHalalas } from './types'

export function paymentsMode(): PaymentProviderName {
  const force = (process.env.DARFIX_PAYMENTS_PROVIDER || '').toLowerCase()
  if (force === 'mock') return 'mock'
  if (force === 'moyasar') return 'moyasar'
  return process.env.MOYASAR_SECRET_KEY ? 'moyasar' : 'mock'
}

/** Prefer Moyasar when secret is present; otherwise mock (local/dev/pilot). */
export function createPaymentProvider(): PaymentProvider {
  const mode = paymentsMode()
  if (mode === 'moyasar') {
    const secret = process.env.MOYASAR_SECRET_KEY
    if (!secret) {
      console.warn('[payments] MOYASAR_SECRET_KEY missing — falling back to mock')
      return new MockPaymentProvider()
    }
    return new MoyasarPaymentProvider(secret, process.env.MOYASAR_PUBLISHABLE_KEY || null)
  }
  return new MockPaymentProvider()
}

let cached: PaymentProvider | null = null

export function getPaymentProvider(): PaymentProvider {
  if (!cached) cached = createPaymentProvider()
  return cached
}

/** Test helper — reset cached provider after env changes. */
export function resetPaymentProviderCache() {
  cached = null
}

export function publicAppBaseUrl(reqHost?: string | null): string {
  const fromEnv = process.env.DARFIX_PUBLIC_URL || process.env.PUBLIC_APP_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (reqHost) {
    const proto = process.env.DARFIX_PUBLIC_PROTO || 'http'
    return `${proto}://${reqHost}`.replace(/\/$/, '')
  }
  const port = process.env.PORT || '8787'
  return `http://127.0.0.1:${port}`
}
