/**
 * Unit Tests for PayPal Payment Service
 *
 * Tests the PayPal payment provider functions:
 * - createPayPalOrder: creates a PayPal order
 * - verifyPayPalWebhook: verifies webhook signatures
 * - refundPayPal: processes refunds
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Store original fetch
const originalFetch = globalThis.fetch

describe('PayPal Payment Service', () => {
  const mockOptions = {
    productId: 'prod_123',
    productName: 'Test Product',
    amount: 1000,
    currency: 'ILS' as const,
    userId: 'user_456',
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
    provider: 'paypal' as const,
  }

  const mockTokenResponse = {
    access_token: 'test_access_token',
    token_type: 'Bearer',
    expires_in: 3600,
  }

  const mockOrderResponse = {
    id: 'ORDER123',
    status: 'CREATED',
    links: [
      { href: 'https://paypal.com/approve', rel: 'approve' },
      { href: 'https://paypal.com/capture', rel: 'capture' },
    ],
  }

  beforeEach(() => {
    // Reset modules to clear token cache
    vi.resetModules()
  })

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch
  })

  describe('createPayPalOrder', () => {
    it('should throw error when PAYPAL_CLIENT_ID is missing', async () => {
      delete process.env.PAYPAL_CLIENT_ID
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'

      const { createPayPalOrder } = await import('@/lib/payment/paypal')

      await expect(createPayPalOrder(mockOptions)).rejects.toThrow(
        'Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable',
      )
    })

    it('should throw error when PAYPAL_CLIENT_SECRET is missing', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      delete process.env.PAYPAL_CLIENT_SECRET

      const { createPayPalOrder } = await import('@/lib/payment/paypal')

      await expect(createPayPalOrder(mockOptions)).rejects.toThrow(
        'Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable',
      )
    })

    it('should fetch token then create order', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'

      let tokenCalled = false
      let orderCalled = false

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          tokenCalled = true
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/checkout/orders')) {
          orderCalled = true
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { createPayPalOrder } = await import('@/lib/payment/paypal')
      const result = await createPayPalOrder(mockOptions)

      expect(tokenCalled).toBe(true)
      expect(orderCalled).toBe(true)
      expect(result.providerSessionId).toBe('ORDER123')
    })

    it('should cache token on first call', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'

      let tokenCallCount = 0

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          tokenCallCount++
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/checkout/orders')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { createPayPalOrder } = await import('@/lib/payment/paypal')

      await createPayPalOrder(mockOptions)
      await createPayPalOrder(mockOptions)

      // Token should only be fetched once due to caching
      expect(tokenCallCount).toBe(1)
    })

    it('should return checkoutUrl and providerSessionId', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/checkout/orders')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { createPayPalOrder } = await import('@/lib/payment/paypal')
      const result = await createPayPalOrder(mockOptions)

      expect(result.checkoutUrl).toBe('https://paypal.com/approve')
      expect(result.providerSessionId).toBe('ORDER123')
    })

    it('should convert amount from smallest unit', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'

      let capturedBody: string | undefined

      globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/checkout/orders')) {
          capturedBody = options?.body as string
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { createPayPalOrder } = await import('@/lib/payment/paypal')
      await createPayPalOrder({ ...mockOptions, amount: 1000 }) // 10.00 in smallest unit

      expect(capturedBody).toBeDefined()
      const body = JSON.parse(capturedBody!)
      expect(body.purchase_units[0].amount.value).toBe('10.00')
    })
  })

  describe('verifyPayPalWebhook', () => {
    const mockHeaders = {
      'paypal-transmission-id': 'trans_id',
      'paypal-transmission-time': '2024-01-01T00:00:00Z',
      'paypal-cert-url': 'https://api.paypal.com/cert',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-sig': 'test_signature',
    }

    it('should throw error when PAYPAL_WEBHOOK_SECRET is missing', async () => {
      delete process.env.PAYPAL_WEBHOOK_SECRET

      const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')

      await expect(verifyPayPalWebhook({ type: 'test' }, mockHeaders)).rejects.toThrow(
        'Missing PAYPAL_WEBHOOK_SECRET environment variable',
      )
    })

    it('should throw error with missing headers', async () => {
      process.env.PAYPAL_WEBHOOK_SECRET = 'webhook_id'
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'

      const incompleteHeaders = {
        'paypal-transmission-id': 'trans_id',
        // Missing other required headers
      }

      const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')

      await expect(verifyPayPalWebhook({ type: 'test' }, incompleteHeaders)).rejects.toThrow(
        'Missing required PayPal webhook headers',
      )
    })

    it('should return true on SUCCESS verification', async () => {
      process.env.PAYPAL_WEBHOOK_SECRET = 'webhook_id'
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v1/notifications/verify-webhook-signature')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ verification_status: 'SUCCESS' }),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { verifyPayPalWebhook } = await import('@/lib/payment/paypal')
      const result = await verifyPayPalWebhook({ type: 'test' }, mockHeaders)

      expect(result).toBe(true)
    })
  })

  describe('refundPayPal', () => {
    it('should POST to capture refund endpoint', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'

      let capturedUrl: string | undefined

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/payments/captures/')) {
          capturedUrl = url
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { refundPayPal } = await import('@/lib/payment/paypal')
      await refundPayPal('CAPTURE123')

      expect(capturedUrl).toContain('/v2/payments/captures/CAPTURE123/refund')
    })

    it('should include amount when provided', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'

      let capturedBody: string | undefined

      globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/payments/captures/')) {
          capturedBody = options?.body as string
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { refundPayPal } = await import('@/lib/payment/paypal')
      await refundPayPal('CAPTURE123', 500)

      expect(capturedBody).toBeDefined()
      const body = JSON.parse(capturedBody!)
      expect(body.amount).toBeDefined()
      expect(body.amount.value).toBe('5.00')
    })

    it('should use ILS currency when specified', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test_client_id'
      process.env.PAYPAL_CLIENT_SECRET = 'test_secret'

      let capturedBody: string | undefined

      globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTokenResponse),
          }) as unknown as Response
        }
        if (url.includes('/v2/payments/captures/')) {
          capturedBody = options?.body as string
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          }) as unknown as Response
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      const { refundPayPal } = await import('@/lib/payment/paypal')
      await refundPayPal('CAPTURE123', 500, 'ILS')

      expect(capturedBody).toBeDefined()
      const body = JSON.parse(capturedBody!)
      expect(body.amount).toBeDefined()
      expect(body.amount.currency_code).toBe('ILS')
    })
  })
})
