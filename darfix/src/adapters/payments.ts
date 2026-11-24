/**
 * Payment adapter interface — swap MockPaymentService for Moyasar/Tap/Stripe later.
 */
export interface PaymentIntent {
  id: string
  amountSar: number
  currency: 'SAR'
  status: 'pending' | 'succeeded' | 'failed'
  invoiceId: string
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
