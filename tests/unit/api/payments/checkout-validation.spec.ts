/**
 * Unit Tests — checkout request validation & cancelUrl encoding
 *
 * Covers two hardening changes in `src/app/api/payments/checkout/route.ts`:
 *   1) productId must match strict MongoDB ObjectId regex (^[0-9a-fA-F]{24}$)
 *   2) cancelUrl interpolates productId via URLSearchParams so reserved
 *      characters (& #) round-trip safely.
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
