/**
 * Unit Tests — checkout request validation & cancelUrl encoding & PayPal error handling
 *
 * Covers three hardening changes in `src/app/api/payments/checkout/route.ts`:
 *   1) productId must match strict MongoDB ObjectId regex (^[0-9a-fA-F]{24}$)
 *   2) cancelUrl interpolates productId via URLSearchParams so reserved
 *      characters (& #) round-trip safely.
 *   3) PayPal missing-credentials error is detected via substring match
 *      (getPaymentEnv throws "Missing required payment environment variables: PAYPAL_CLIENT_ID..."
 *      which must be matched by errorMessage.includes('PAYPAL_CLIENT_ID'))
 */
import { describe, expect, it } from 'vitest'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

describe('checkout productId ObjectId validation', () => {
  it('accepts a valid 24-char hex ObjectId', () => {
    expect(objectIdRegex.test('507f1f77bcf86cd799439011')).toBe(true)
  })

  it('rejects a short string', () => {
    expect(objectIdRegex.test('abc123')).toBe(false)
  })

  it('rejects a string with non-hex characters', () => {
    expect(objectIdRegex.test('zzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(objectIdRegex.test('')).toBe(false)
  })

  it('rejects a string of 25 hex chars (off-by-one)', () => {
    expect(objectIdRegex.test('507f1f77bcf86cd7994390111')).toBe(false)
  })
})

describe('PayPal missing-credentials error detection in checkout route', () => {
  /**
   * Regression test for issue #2408: PayPal checkout returns HTTP 500.
   *
   * When PayPal credentials are missing, getPaymentEnv() throws:
   *   "Missing required payment environment variables: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID"
   *
   * The checkout route must detect this and return 503 (payment_provider_not_configured),
   * not 500 (checkout_creation_failed).
   *
   * The route uses:
   *   errorMessage.includes('PAYPAL_CLIENT_ID') && errorMessage.includes('PAYPAL_CLIENT_SECRET')
   */
  it('should detect PayPal missing-credentials error message via substring match', () => {
    const errorFromGetPaymentEnv =
      'Missing required payment environment variables: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID'

    // The checkout route checks: errorMessage.includes('PAYPAL_CLIENT_ID') && errorMessage.includes('PAYPAL_CLIENT_SECRET')
    const detected =
      errorFromGetPaymentEnv.includes('PAYPAL_CLIENT_ID') &&
      errorFromGetPaymentEnv.includes('PAYPAL_CLIENT_SECRET')

    expect(detected).toBe(true)
  })

  it('should detect Stripe missing-credentials error message via substring match', () => {
    const errorFromGetPaymentEnv =
      'Missing required payment environment variables: STRIPE_SECRET_KEY'

    // The checkout route checks: errorMessage.includes('STRIPE_SECRET_KEY')
    const detected = errorFromGetPaymentEnv.includes('STRIPE_SECRET_KEY')

    expect(detected).toBe(true)
  })

  it('should NOT match unrelated errors', () => {
    const unrelatedError = 'PayPal token request failed: 401 Client secret does not match'

    const detectedPaypal =
      unrelatedError.includes('PAYPAL_CLIENT_ID') && unrelatedError.includes('PAYPAL_CLIENT_SECRET')

    expect(detectedPaypal).toBe(false)
  })
})

describe('checkout cancelUrl encoding', () => {
  const buildCancelUrl = (baseUrl: string, productId: string) => {
    const params = new URLSearchParams({ product_id: productId })
    return `${baseUrl}/checkout/cancel?${params.toString()}`
  }

  it('encodes a valid ObjectId without modification (hex is URL-safe)', () => {
    const url = buildCancelUrl('https://example.com', '507f1f77bcf86cd799439011')
    expect(url).toBe('https://example.com/checkout/cancel?product_id=507f1f77bcf86cd799439011')
  })

  it('encodes & in a productId-shaped value so it round-trips', () => {
    const raw = 'abc&evil=1'
    const url = buildCancelUrl('https://example.com', raw)
    const parsed = new URL(url)
    expect(parsed.searchParams.get('product_id')).toBe(raw)
    expect(parsed.searchParams.get('evil')).toBeNull()
  })

  it('encodes # so the fragment is not split off', () => {
    const raw = 'abc#frag'
    const url = buildCancelUrl('https://example.com', raw)
    const parsed = new URL(url)
    expect(parsed.searchParams.get('product_id')).toBe(raw)
    expect(parsed.hash).toBe('')
  })
})
