/**
 * Payment Environment Variables Helper
 *
 * @fileType utility
 * @domain payment
 * @pattern env-vault
 * @ai-summary Validates and exposes payment provider environment variables.
 *
 * Validates required payment secrets on first call and provides
 * type-safe access to all payment-related environment variables.
 */

export interface PaymentEnv {
  stripeSecretKey: string
  stripePublishableKey: string
  stripeWebhookSecret: string
  stripeCurrency: string
  paypalClientId: string
  paypalClientSecret: string
  paypalWebhookId: string
  paypalSandbox: boolean
}

interface PaymentEnvValidation {
  required: boolean
  value: string | undefined
  name: string
}

let validatedEnv: PaymentEnv | null = null

/**
 * Get and validate all payment environment variables.
 * Throws if any required variable is missing.
 * Caches result after first call.
 */
export function getPaymentEnv(): PaymentEnv {
  if (validatedEnv) {
    return validatedEnv
  }

  const vars: PaymentEnvValidation[] = [
    { name: 'STRIPE_SECRET_KEY', required: true, value: process.env.STRIPE_SECRET_KEY },
    { name: 'STRIPE_PUBLISHABLE_KEY', required: false, value: process.env.STRIPE_PUBLISHABLE_KEY },
    { name: 'STRIPE_WEBHOOK_SECRET', required: false, value: process.env.STRIPE_WEBHOOK_SECRET },
    { name: 'STRIPE_CURRENCY', required: false, value: process.env.STRIPE_CURRENCY },
    { name: 'PAYPAL_CLIENT_ID', required: true, value: process.env.PAYPAL_CLIENT_ID },
    { name: 'PAYPAL_CLIENT_SECRET', required: true, value: process.env.PAYPAL_CLIENT_SECRET },
    { name: 'PAYPAL_WEBHOOK_ID', required: false, value: process.env.PAYPAL_WEBHOOK_ID },
    { name: 'PAYPAL_SANDBOX', required: false, value: process.env.PAYPAL_SANDBOX },
  ]

  const missing = vars.filter((v) => v.required && !v.value)
  if (missing.length > 0) {
    throw new Error(
      `Missing required payment environment variables: ${missing.map((v) => v.name).join(', ')}`,
    )
  }

  validatedEnv = {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    stripeCurrency: process.env.STRIPE_CURRENCY ?? 'ILS',
    paypalClientId: process.env.PAYPAL_CLIENT_ID ?? '',
    paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
    paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID ?? '',
    paypalSandbox: process.env.PAYPAL_SANDBOX === 'true',
  }

  return validatedEnv
}

/**
 * Reset the cached environment (useful for testing)
 */
export function resetPaymentEnvCache(): void {
  validatedEnv = null
}
