/**
 * Notification adapter — mock today; replace with WhatsApp Business / SMS / push later.
 */
export type Channel = 'in_app' | 'whatsapp' | 'sms' | 'email'

export interface OutboundMessage {
  channel: Channel
  to: string
  templateId: string
  payload: Record<string, string>
  sentAt: string
}

export interface NotificationService {
  send(message: Omit<OutboundMessage, 'sentAt'>): Promise<OutboundMessage>
  getWhatsAppSupportUrl(phoneE164: string, text?: string): string
}

export class MockNotificationService implements NotificationService {
  readonly log: OutboundMessage[] = []

  async send(message: Omit<OutboundMessage, 'sentAt'>): Promise<OutboundMessage> {
    const full: OutboundMessage = { ...message, sentAt: new Date().toISOString() }
    this.log.push(full)
    console.info('[notifications]', full.channel, full.templateId, full.to)
    return full
  }

  getWhatsAppSupportUrl(phoneE164: string, text = 'Hello DARFIX support'): string {
    const digits = phoneE164.replace(/\D/g, '')
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
  }
}

export const notificationService: NotificationService = new MockNotificationService()

/** Public support WhatsApp for customers */
export const SUPPORT_WHATSAPP = '+966500000000'
