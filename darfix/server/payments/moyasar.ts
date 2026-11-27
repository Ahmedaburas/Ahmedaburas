import type {
  CreateSubscriptionCheckoutInput,
  CreateSubscriptionCheckoutResult,
  PaymentProvider,
} from './types'
import { sarToHalalas } from './types'

const MOYASAR_API = 'https://api.moyasar.com/v1'

/**
 * Moyasar (KSA) — invoices support Mada, Visa, Mastercard.
 * Settlement lands in the platform merchant account (Ahmed's IBAN after PSP KYC).
 * Partner companies never upload CR into DARFIX for subscription payment.
 */
export class MoyasarPaymentProvider implements PaymentProvider {
  readonly name = 'moyasar' as const

  constructor(
    private readonly secretKey: string,
    private readonly publishableKey: string | null,
  ) {}

  private authHeader(): string {
    const token = Buffer.from(`${this.secretKey}:`).toString('base64')
    return `Basic ${token}`
  }

  async createSubscriptionCheckout(
    input: CreateSubscriptionCheckoutInput,
  ): Promise<CreateSubscriptionCheckoutResult> {
    const body = {
      amount: sarToHalalas(input.amountSar),
      currency: 'SAR',
      description: `DARFIX ${input.planLabel} subscription`,
      callback_url: input.callbackUrl,
      success_url: input.successUrl,
      back_url: input.backUrl,
      metadata: {
        darfix_checkout_id: input.checkoutId,
        organization_id: input.organizationId,
        plan_id: input.planId,
        ...(input.metadata ?? {}),
      },
    }

    const res = await fetch(`${MOYASAR_API}/invoices`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const msg =
        typeof raw.message === 'string'
          ? raw.message
          : typeof raw.error === 'string'
            ? raw.error
            : `Moyasar invoice failed (${res.status})`
      throw new Error(msg)
    }

    const externalId = String(raw.id ?? '')
    const checkoutUrl = String(raw.url ?? raw.checkout_url ?? '')
    if (!externalId || !checkoutUrl) {
      throw new Error('Moyasar invoice response missing id/url')
    }

    return {
      provider: 'moyasar',
      externalId,
      checkoutUrl,
      publishableKey: this.publishableKey,
      raw,
    }
  }

  async fetchCheckoutStatus(externalId: string) {
    const res = await fetch(`${MOYASAR_API}/invoices/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: this.authHeader() },
    })
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      throw new Error(
        typeof raw.message === 'string' ? raw.message : `Moyasar fetch failed (${res.status})`,
      )
    }
    const status = String(raw.status ?? 'unknown')
    return {
      paid: status === 'paid',
      status,
      amountHalalas: typeof raw.amount === 'number' ? raw.amount : undefined,
      raw,
    }
  }
}
