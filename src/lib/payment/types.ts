/**
 * Payment Service Types
 *
 * Shared types for Stripe and PayPal payment providers.
 * Used by checkout creation, webhook verification, and refund operations.
 */

export type PaymentProvider = 'stripe' | 'paypal'

export type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

export interface CreateCheckoutOptions {
  productId: string
  productName: string
  amount: number // in smallest currency unit (agorot/cents)
  currency: 'ILS' | 'USD' | 'EUR'
  userId: string
  successUrl: string
  cancelUrl: string
  provider: PaymentProvider
}

export interface CheckoutResult {
  checkoutUrl: string
  providerSessionId: string // stripe session ID or paypal order ID
}

export interface WebhookVerifyOptions {
  rawBody: Buffer
  signature: string // stripe-signature header or paypal transmission sig
  webhookSecret: string
  provider: PaymentProvider
}
