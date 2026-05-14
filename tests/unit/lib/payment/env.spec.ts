/**
 * Unit Tests for Payment Environment Helper
 *
 * Tests the getPaymentEnv() helper function that validates
 * payment environment variables and provides type-safe access.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getPaymentEnv, resetPaymentEnvCache } from '@/lib/payment/env'

describe('Payment Environment Helper', () => {
  beforeEach(() => {
    vi.resetModules()
    resetPaymentEnvCache()
  })

  afterEach(() => {
    resetPaymentEnvCache()
    vi.restoreAllMocks()
  })

  describe('getPaymentEnv', () => {
    it('should return all payment env vars when all are set', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_xxx'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'
      process.env.STRIPE_CURRENCY = 'ILS'
      process.env.PAYPAL_CLIENT_ID = 'client_id_xxx'
      process.env.PAYPAL_CLIENT_SECRET = 'client_secret_xxx'
      process.env.PAYPAL_WEBHOOK_ID = 'webhook_id_xxx'
      process.env.PAYPAL_SANDBOX = 'true'

      const env = getPaymentEnv()

      expect(env.stripeSecretKey).toBe('sk_test_xxx')
      expect(env.stripePublishableKey).toBe('pk_test_xxx')
      expect(env.stripeWebhookSecret).toBe('whsec_xxx')
      expect(env.stripeCurrency).toBe('ILS')
      expect(env.paypalClientId).toBe('client_id_xxx')
      expect(env.paypalClientSecret).toBe('client_secret_xxx')
      expect(env.paypalWebhookId).toBe('webhook_id_xxx')
      expect(env.paypalSandbox).toBe(true)
    })

    it('should return PAYPAL_SANDBOX as false when not set', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.PAYPAL_CLIENT_SECRET = 'client_secret_xxx'
      delete process.env.PAYPAL_SANDBOX

      const env = getPaymentEnv()

      expect(env.paypalSandbox).toBe(false)
    })

    it('should return PAYPAL_SANDBOX as true when set to "true"', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.PAYPAL_CLIENT_SECRET = 'client_secret_xxx'
      process.env.PAYPAL_SANDBOX = 'true'

      const env = getPaymentEnv()

      expect(env.paypalSandbox).toBe(true)
    })

    it('should return default STRIPE_CURRENCY of ILS when not set', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.PAYPAL_CLIENT_SECRET = 'client_secret_xxx'
      delete process.env.STRIPE_CURRENCY

      const env = getPaymentEnv()

      expect(env.stripeCurrency).toBe('ILS')
    })

    it('should throw when STRIPE_SECRET_KEY is missing', () => {
      delete process.env.STRIPE_SECRET_KEY
      process.env.PAYPAL_CLIENT_SECRET = 'client_secret_xxx'

      expect(() => getPaymentEnv()).toThrow(
        'Missing required payment environment variables: STRIPE_SECRET_KEY',
      )
    })

    it('should throw when PAYPAL_CLIENT_SECRET is missing', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      delete process.env.PAYPAL_CLIENT_SECRET

      expect(() => getPaymentEnv()).toThrow(
        'Missing required payment environment variables: PAYPAL_CLIENT_SECRET',
      )
    })

    it('should throw when both required keys are missing', () => {
      delete process.env.STRIPE_SECRET_KEY
      delete process.env.PAYPAL_CLIENT_SECRET

      expect(() => getPaymentEnv()).toThrow(
        'Missing required payment environment variables: STRIPE_SECRET_KEY, PAYPAL_CLIENT_SECRET',
      )
    })

    it('should cache result on subsequent calls', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.PAYPAL_CLIENT_SECRET = 'client_secret_xxx'

      const env1 = getPaymentEnv()
      const env2 = getPaymentEnv()

      expect(env1).toBe(env2) // Same object reference due to caching
    })

    it('should return empty string for optional vars when not set', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.PAYPAL_CLIENT_ID = 'client_id_xxx'
      process.env.PAYPAL_CLIENT_SECRET = 'client_secret_xxx'
      delete process.env.STRIPE_PUBLISHABLE_KEY
      delete process.env.STRIPE_WEBHOOK_SECRET
      delete process.env.PAYPAL_WEBHOOK_ID

      const env = getPaymentEnv()

      expect(env.stripePublishableKey).toBe('')
      expect(env.stripeWebhookSecret).toBe('')
      expect(env.paypalClientId).toBe('client_id_xxx')
      expect(env.paypalWebhookId).toBe('')
    })
  })

  describe('resetPaymentEnvCache', () => {
    it('should clear cached env and return new values', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.PAYPAL_CLIENT_ID = 'client_id_xxx'
      process.env.PAYPAL_CLIENT_SECRET = 'client_secret_xxx'

      const env1 = getPaymentEnv()
      expect(env1.stripeSecretKey).toBe('sk_test_xxx')

      // Change the env var
      process.env.STRIPE_SECRET_KEY = 'sk_test_yyy'

      // Without reset, should still return cached value
      const env2 = getPaymentEnv()
      expect(env2.stripeSecretKey).toBe('sk_test_xxx')

      // After reset, should return new value
      resetPaymentEnvCache()
      const env3 = getPaymentEnv()
      expect(env3.stripeSecretKey).toBe('sk_test_yyy')
    })
  })
})
