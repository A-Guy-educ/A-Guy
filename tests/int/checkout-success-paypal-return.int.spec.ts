// @vitest-environment node
/**
 * Unit tests: Checkout Success Page — PayPal Return Bug #2479
 *
 * Bug #2479: PayPal return renders "No Session Found" on success page.
 *   - PayPal redirects to /checkout/success?provider=paypal&token=<ORDER_ID>&PayerID=<PAYER_ID>
 *   - page.tsx only reads session_id (Stripe) → token is undefined
 *   - if (session_id) is false → skips transaction lookup → "No Session Found" rendered
 *   - Fix: read provider=paypal and token; use token as providerTransactionId for lookup
 *
 * These tests verify the lookup-key determination logic by checking what
 * providerTransactionId value the page uses when calling payload.find.
 *
 * @fileType unit-test
 * @domain payments
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Payload and dependencies BEFORE importing the page module
// ---------------------------------------------------------------------------

const mockFind = vi.fn()
const mockFindByID = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn(() =>
    Promise.resolve({
      find: mockFind,
      findByID: mockFindByID,
    }),
  ),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('@/i18n/server-locale', () => ({
  getSystemLocale: vi.fn().mockResolvedValue('en'),
}))

vi.mock('@/i18n/config', () => ({
  getDirection: vi.fn().mockReturnValue('ltr'),
}))

vi.mock('@/infra/seo/pageMetadata', () => ({
  pageMetadata: vi.fn().mockReturnValue({ title: 'Payment Confirmed' }),
}))

// Mock CheckoutSuccessContent to prevent client component issues
vi.mock('@/app/(frontend)/checkout/success/CheckoutSuccessContent', () => ({
  CheckoutSuccessContent: vi.fn(() => null),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CheckoutSuccessPage — PayPal Return Bug #2479', () => {
  const PAYPAL_ORDER_ID = `paypal_test_order_${Date.now()}`
  const STRIPE_SESSION_ID = `cs_test_stripe_${Date.now()}`

  const mockPendingTransaction = {
    id: 'tx_2479_paypal',
    provider: 'paypal',
    providerTransactionId: PAYPAL_ORDER_ID,
    status: 'pending',
    product: 'prod_123',
    user: 'user_123',
    amount: 10000,
    currency: 'ILS',
    metadata: {},
    successUrl: `http://localhost:3000/checkout/success?provider=paypal`,
    cancelUrl: `http://localhost:3000/checkout/cancel`,
    entitlementsGrantedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  beforeAll(() => {
    mockFind.mockReset()
    mockFindByID.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * THE BUG (reproduced here):
   *
   * In page.tsx, the only lookup key read from searchParams is session_id:
   *   const { session_id } = await searchParamsPromise
   *
   * For PayPal, the redirect URL is:
   *   /checkout/success?provider=paypal&token=<ORDER_ID>&PayerID=<PAYER_ID>
   *
   * There is NO session_id parameter. session_id is undefined.
   * The code checks: if (session_id) { ... lookup ... }
   * Since session_id is falsy, the lookup block is SKIPPED.
   * The page then renders CheckoutSuccessContent with transaction=null → "No Session Found".
   *
   * THE FIX:
   * When provider=paypal, use token (PayPal order ID) as the lookup key.
   *
   * BEFORE FIX: mockFind is NOT called (session_id is undefined)
   * AFTER FIX:  mockFind IS called with providerTransactionId.equals = PAYPAL_ORDER_ID
   */
  it('should call payload.find with PayPal order ID when redirected from PayPal', async () => {
    // Setup: return the pending PayPal transaction when queried by order ID
    mockFind.mockResolvedValueOnce({
      docs: [mockPendingTransaction],
      totalDocs: 1,
    })
    mockFindByID.mockResolvedValueOnce({ name: 'Test Product' })

    // Import page module (mocks are already set up via vi.mock at top of file)
    const page = await import('@/app/(frontend)/checkout/success/page')

    // Simulate PayPal redirect: /checkout/success?provider=paypal&token=<ORDER_ID>&PayerID=xxx
    const searchParams = {
      provider: 'paypal',
      token: PAYPAL_ORDER_ID,
      PayerID: 'PAYPAL_PAYER_ID_TEST',
    }

    await page.default({ searchParams: Promise.resolve(searchParams) })

    // THE KEY ASSERTION:
    // BEFORE FIX: session_id is undefined → if (session_id) is false → payload.find NOT called
    // AFTER FIX:  provider=paypal && token → payload.find IS called with providerTransactionId = token
    expect(mockFind).toHaveBeenCalledTimes(1)

    const findCallArgs = mockFind.mock.calls[0][0]
    expect(findCallArgs.collection).toBe('transactions')
    expect(findCallArgs.where.providerTransactionId.equals).toBe(PAYPAL_ORDER_ID)
  })

  /**
   * Regression test: Stripe session_id still works as before.
   * The fix must NOT break existing Stripe behavior.
   */
  it('should call payload.find with Stripe session_id (regression check)', async () => {
    const stripeTransaction = {
      ...mockPendingTransaction,
      provider: 'stripe',
      providerTransactionId: STRIPE_SESSION_ID,
    }
    mockFind.mockResolvedValueOnce({ docs: [stripeTransaction], totalDocs: 1 })
    mockFindByID.mockResolvedValueOnce({ name: 'Test Product' })

    const page = await import('@/app/(frontend)/checkout/success/page')

    await page.default({ searchParams: Promise.resolve({ session_id: STRIPE_SESSION_ID }) })

    expect(mockFind).toHaveBeenCalledTimes(1)
    const findCallArgs = mockFind.mock.calls[0][0]
    expect(findCallArgs.where.providerTransactionId.equals).toBe(STRIPE_SESSION_ID)
  })

  /**
   * Edge case: No identifiable session/token — page should not call payload.find.
   * This means the page renders "Processing" state (transaction=null but sessionId=undefined
   * triggers "missing session" in CheckoutSuccessContent).
   */
  it('should NOT call payload.find when neither session_id nor PayPal token is provided', async () => {
    const page = await import('@/app/(frontend)/checkout/success/page')

    await page.default({ searchParams: Promise.resolve({}) })

    // No session_id, no token → no lookup possible
    expect(mockFind).not.toHaveBeenCalled()
  })
})
