/**
 * Payment adapter interface — Mock for local/dev; Moyasar (preferred) or Tap in production.
 *
 * Subscription checkout for partner plans settles to the **platform merchant**
 * (DARFIX owner) via the PSP. Partner companies do not upload CR/business
 * certificates into DARFIX for paying their SaaS subscription — PSP KYC is
 * between the platform owner and Moyasar/Tap.
 *
 * Server implementation: `server/payments/` (uses MOYASAR_SECRET_KEY when set).
 */
export interface PaymentIntent {
  id: string
  amountSar: number
  currency: 'SAR'
  status: 'pending' | 'succeeded' | 'failed'
  invoiceId: string
}

export interface SubscriptionCheckoutIntent {
  id: string
  planId: string
  amountSar: number
  currency: 'SAR'
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'canceled'
  provider: 'moyasar' | 'mock'
  checkoutUrl: string
  /** Mada, Visa, Mastercard via hosted Moyasar/Tap page (or mock simulate). */
  methods: ('mada' | 'visa' | 'mastercard')[]
}

export interface PaymentService {
  createIntent(invoiceId: string, amountSar: number): Promise<PaymentIntent>
  confirmPayment(intentId: string): Promise<PaymentIntent>
}

export class MockPaymentService implements PaymentService {
  private intents = new Map<string, PaymentIntent>()

  async createIntent(invoiceId: string, amountSar: number): Promise<PaymentIntent> {
    const intent: PaymentIntent = {
      id: `pi_${Date.now()}`,
      amountSar,
      currency: 'SAR',
      status: 'pending',
      invoiceId,
    }
    this.intents.set(intent.id, intent)
    return intent
  }

  async confirmPayment(intentId: string): Promise<PaymentIntent> {
    const intent = this.intents.get(intentId)
    if (!intent) throw new Error('Payment intent not found')
    intent.status = 'succeeded'
    return intent
  }
}

export const paymentService: PaymentService = new MockPaymentService()

/** Card brands accepted for partner subscription checkout (KSA acquiring). */
export const SUBSCRIPTION_CARD_METHODS = ['mada', 'visa', 'mastercard'] as const
