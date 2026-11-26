/** Server-side subscription payment provider contracts (Moyasar / mock). */

export type PaymentProviderName = 'moyasar' | 'mock'

export type CheckoutStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'canceled'

export interface CreateSubscriptionCheckoutInput {
  checkoutId: string
  organizationId: string
  organizationName: string
  planId: string
  planLabel: string
  amountSar: number
  /** Absolute URLs for hosted checkout redirects. */
  successUrl: string
  backUrl: string
  callbackUrl: string
  metadata?: Record<string, string>
}

export interface CreateSubscriptionCheckoutResult {
  provider: PaymentProviderName
  externalId: string
  checkoutUrl: string
  /** Publishable / public key for client widgets when available. */
  publishableKey?: string | null
  raw?: unknown
}

export interface PaymentProvider {
  readonly name: PaymentProviderName
  createSubscriptionCheckout(
    input: CreateSubscriptionCheckoutInput,
  ): Promise<CreateSubscriptionCheckoutResult>
  /**
   * Fetch remote payment/invoice status when the PSP supports it.
   * Mock returns based on local state only (caller activates on simulate).
   */
  fetchCheckoutStatus?(externalId: string): Promise<{
    paid: boolean
    status: string
    amountHalalas?: number
    raw?: unknown
  }>
}

export function sarToHalalas(amountSar: number): number {
  return Math.round(amountSar * 100)
}
