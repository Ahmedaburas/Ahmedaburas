import type {
  CreateSubscriptionCheckoutInput,
  CreateSubscriptionCheckoutResult,
  PaymentProvider,
} from './types'

/**
 * Local/dev payment provider — no PSP keys required.
 * Checkout URL points at the in-app billing page; partners complete via
 * POST /api/org/subscription/checkout/:id/simulate (auth).
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock' as const

  async createSubscriptionCheckout(
    input: CreateSubscriptionCheckoutInput,
  ): Promise<CreateSubscriptionCheckoutResult> {
    const externalId = `mock_inv_${input.checkoutId}`
    const url = new URL(input.successUrl)
    url.searchParams.set('checkout', input.checkoutId)
    url.searchParams.set('mock', '1')
    return {
      provider: 'mock',
      externalId,
      checkoutUrl: url.toString(),
      publishableKey: null,
      raw: { mode: 'mock', planId: input.planId, amountSar: input.amountSar },
    }
  }

  async fetchCheckoutStatus(externalId: string) {
    return { paid: false, status: 'pending', raw: { externalId, provider: 'mock' } }
  }
}
