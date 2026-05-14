/**
 * Unit Tests for Stripe Payment Service
 *
 * Tests the stripe payment provider functions:
 * - createStripeCheckout: creates a checkout session
 * - verifyStripeWebhook: verifies webhook signatures
 * - refundStripe: processes refunds
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

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

// Mock the stripe module with a proper constructor function
vi.mock('stripe', () => {
  class MockStripe {
    checkout = {
      sessions: {
        create: vi.fn().mockResolvedValue(mockSession),
      },
    }
    refunds = {
      create: vi.fn().mockResolvedValue(mockRefund),
    }
    webhooks = {
      constructEvent: vi.fn().mockReturnValue(mockEvent),
    }
  }
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
    // Reset env
    process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'
    // Reset module to clear singleton
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createStripeCheckout', () => {
    it('should throw error when STRIPE_SECRET_KEY is missing', async () => {
      delete process.env.STRIPE_SECRET_KEY

      // Need fresh import after env change
      vi.resetModules()
      const { createStripeCheckout } = await import('@/lib/payment/stripe')

      await expect(createStripeCheckout(mockOptions)).rejects.toThrow(
        'Missing STRIPE_SECRET_KEY environment variable',
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

      // Just verify no error is thrown
      expect(true).toBe(true)
    })

    it('should create refund with amount when provided', async () => {
      const { refundStripe } = await import('@/lib/payment/stripe')

      await refundStripe('pi_test_transaction_id', 500)

      expect(true).toBe(true)
    })
  })
})
