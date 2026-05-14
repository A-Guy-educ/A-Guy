/**
 * PayPal Payment Service
 *
 * Provides order creation, webhook verification, and refund operations.
 * Requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.
 */

import type { CreateCheckoutOptions, CheckoutResult } from './types'

const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com'

interface PayPalTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface PayPalOrderResponse {
  id: string
  status: string
  links: Array<{ href: string; rel: string }>
}

// Lazy-loaded token cache
let _cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Get or refresh PayPal access token
 */
async function getPayPalAccessToken(): Promise<string> {
  const now = Date.now()

  // Return cached token if still valid (with 60s buffer)
  if (_cachedToken && _cachedToken.expiresAt > now + 60_000) {
    return _cachedToken.token
  }

  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`PayPal token request failed: ${response.status} ${error}`)
  }

  const data = (await response.json()) as PayPalTokenResponse
  _cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  }

  return _cachedToken.token
}

/**
 * Create a PayPal order
 */
export async function createPayPalOrder(options: CreateCheckoutOptions): Promise<CheckoutResult> {
  const { productId, productName, amount, currency, userId, successUrl, cancelUrl } = options
  const token = await getPayPalAccessToken()

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `${userId}-${productId}-${Date.now()}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: productId,
          description: productName,
          amount: {
            currency_code: currency,
            value: (amount / 100).toFixed(2), // Convert from smallest unit
          },
          custom_id: userId,
        },
      ],
      application_context: {
        return_url: successUrl,
        cancel_url: cancelUrl,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`PayPal order creation failed: ${response.status} ${error}`)
  }

  const order = (await response.json()) as PayPalOrderResponse

  // Find approval URL
  const approvalLink = order.links.find((link) => link.rel === 'approve')
  if (!approvalLink) {
    throw new Error('PayPal order missing approval URL')
  }

  return { checkoutUrl: approvalLink.href, providerSessionId: order.id }
}

/**
 * Verify a PayPal webhook signature
 * Uses PayPal's verify-webhook-signature API
 */
export async function verifyPayPalWebhook(body: object, headers: object): Promise<boolean> {
  const webhookSecret = process.env.PAYPAL_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('Missing PAYPAL_WEBHOOK_SECRET environment variable')
  }

  // Extract required headers first (fail fast)
  const transmissionId = (headers as Record<string, string>)['paypal-transmission-id']
  const transmissionTime = (headers as Record<string, string>)['paypal-transmission-time']
  const certUrl = (headers as Record<string, string>)['paypal-cert-url']
  const authAlgo = (headers as Record<string, string>)['paypal-auth-algo']
  const transmissionSig = (headers as Record<string, string>)['paypal-transmission-sig']

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    throw new Error('Missing required PayPal webhook headers')
  }

  const token = await getPayPalAccessToken()

  const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookSecret,
      webhook_event: body,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`PayPal webhook verification failed: ${response.status} ${error}`)
  }

  const result = (await response.json()) as { verification_status: string }
  return result.verification_status === 'SUCCESS'
}

/**
 * Refund a PayPal capture
 */
export async function refundPayPal(
  providerTransactionId: string,
  amount?: number,
  currency: 'ILS' | 'USD' | 'EUR' = 'USD',
): Promise<void> {
  const token = await getPayPalAccessToken()

  const refundBody: Record<string, unknown> = {}
  if (amount !== undefined) {
    refundBody.amount = {
      value: (amount / 100).toFixed(2),
      currency_code: currency,
    }
  }

  const response = await fetch(
    `${PAYPAL_API_BASE}/v2/payments/captures/${providerTransactionId}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(refundBody),
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`PayPal refund failed: ${response.status} ${error}`)
  }
}

/**
 * Cancel/void a PayPal order
 * Used when transaction record creation fails after order was created
 */
export async function cancelPayPalOrder(providerTransactionId: string): Promise<void> {
  const token = await getPayPalAccessToken()

  const response = await fetch(
    `${PAYPAL_API_BASE}/v2/checkout/orders/${providerTransactionId}/void`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`PayPal order void failed: ${response.status} ${error}`)
  }
}
