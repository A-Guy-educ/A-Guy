/**
 * Stripe Payment Service
 *
 * Provides checkout session creation, webhook verification, and refund operations.
 * Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET environment variables.
 */

import Stripe from 'stripe'
import type { CreateCheckoutOptions, CheckoutResult } from './types'

// Lazy-loaded Stripe client (avoids env requirement during module load)
let _stripeClient: Stripe | null = null

function getStripeClient(): Stripe {
  if (_stripeClient) return _stripeClient

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable')
  }

  _stripeClient = new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
  })
  return _stripeClient
}

/**
 * Create a Stripe checkout session
 */
export async function createStripeCheckout(
  options: CreateCheckoutOptions,
): Promise<CheckoutResult> {
  const stripe = getStripeClient()
  const { productId, productName, amount, currency, userId, successUrl, cancelUrl } = options

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: productName,
            metadata: { productId },
          },
          unit_amount: amount, // already in smallest unit
        },
        quantity: 1,
      },
    ],
    metadata: { productId, userId },
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  if (!session.url || !session.id) {
    throw new Error('Stripe checkout session missing url or id')
  }

  return { checkoutUrl: session.url, providerSessionId: session.id }
}

/**
 * Verify and parse a Stripe webhook event
 */
export async function verifyStripeWebhook(
  payload: Buffer,
  signature: string,
): Promise<Stripe.Event> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable')
  }

  const stripe = getStripeClient()
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
}

/**
 * Create a Stripe refund
 */
export async function refundStripe(providerTransactionId: string, amount?: number): Promise<void> {
  const stripe = getStripeClient()
  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: providerTransactionId,
  }
  if (amount !== undefined) {
    refundParams.amount = amount // in smallest currency unit
  }
  await stripe.refunds.create(refundParams)
}
