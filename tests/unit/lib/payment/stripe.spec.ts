/**
 * Unit Tests for Stripe Payment Service
 *
 * Tests the stripe payment provider functions:
 * - createStripeCheckout: creates a checkout session
 * - verifyStripeWebhook: verifies webhook signatures
 * - refundStripe: processes refunds
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { resetPaymentEnvCache } from '@/lib/payment/env'

// Mock data
const mockSession = {
  id: 'cs_test_session_id',
  url: 'https://checkout.stripe.com/test',
}
const mockRefund = {
  id: 're_test_refund_id',
  status: 'succeeded',
}
const mockEvent = {
  id: 'evt_test_event_id',
  type: 'checkout.session.completed',
  data: { object: mockSession },
}

// Module-level reference to the refunds.create mock for test assertions
const refundsCreateMock = vi.fn().mockResolvedValue(mockRefund) as ReturnType<typeof vi.fn>

// Mock the stripe module
vi.mock('stripe', () => {
  class MockStripe {
    checkout = {
      sessions: {
        create: vi.fn().mockResolvedValue(mockSession),
      },
    }
    webhooks = {
      constructEvent: vi.fn().mockReturnValue(mockEvent),
    }
  }

  // Use getter so all instances share the same mock
  Object.defineProperty(MockStripe.prototype, 'refunds', {
    get() {
      return { create: refundsCreateMock }
    },
  })

  return { default: MockStripe }
})

describe('Stripe Payment Service', () => {
  const mockOptions = {
    productId: 'prod_123',
    productName: 'Test Product',
    amount: 1000,
    currency: 'ILS' as const,
    userId: 'user_456',
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
    provider: 'stripe' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset env cache
    resetPaymentEnvCache()
    // Set all required payment env vars
    process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'
    process.env.PAYPAL_CLIENT_ID = 'paypal_client_id_xxx'
    process.env.PAYPAL_CLIENT_SECRET = 'paypal_secret_xxx'
    // Reset module to clear singletons
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createStripeCheckout', () => {
    it('should throw error when STRIPE_SECRET_KEY is missing', async () => {
      delete process.env.STRIPE_SECRET_KEY
      resetPaymentEnvCache()

      // Need fresh import after env change
      vi.resetModules()
      const { createStripeCheckout } = await import('@/lib/payment/stripe')

      await expect(createStripeCheckout(mockOptions)).rejects.toThrow(
        'Missing required payment environment variables: STRIPE_SECRET_KEY',
      )
    })

    it('should create checkout session and return result', async () => {
      const { createStripeCheckout } = await import('@/lib/payment/stripe')

      const result = await createStripeCheckout(mockOptions)

      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/test')
      expect(result.providerSessionId).toBe('cs_test_session_id')
    })
  })

  describe('verifyStripeWebhook', () => {
    it('should throw error when STRIPE_WEBHOOK_SECRET is missing', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET
      resetPaymentEnvCache()

      vi.resetModules()
      const { verifyStripeWebhook } = await import('@/lib/payment/stripe')

      await expect(
        verifyStripeWebhook(Buffer.from('test payload'), 'test_signature'),
      ).rejects.toThrow('Missing STRIPE_WEBHOOK_SECRET environment variable')
    })

    it('should verify webhook payload and signature', async () => {
      const { verifyStripeWebhook } = await import('@/lib/payment/stripe')

      const payload = Buffer.from('test payload')
      const signature = 'test_signature'

      const event = await verifyStripeWebhook(payload, signature)

      expect(event.id).toBe('evt_test_event_id')
    })
  })

  describe('refundStripe', () => {
    it('should create refund with transaction id', async () => {
      const { refundStripe } = await import('@/lib/payment/stripe')

      await refundStripe('pi_test_transaction_id')

      expect(refundsCreateMock).toHaveBeenCalledWith({
        payment_intent: 'pi_test_transaction_id',
      })
    })

    it('should create refund with amount when provided', async () => {
      const { refundStripe } = await import('@/lib/payment/stripe')

      await refundStripe('pi_test_transaction_id', 500)

      expect(refundsCreateMock).toHaveBeenCalledWith({
        payment_intent: 'pi_test_transaction_id',
        amount: 500,
      })
    })
  })
})
