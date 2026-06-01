// @vitest-environment jsdom
/**
 * @fileType test
 * @domain auth | frontend
 * @ai-summary Regression test for issue #2282: BuyButton shows 'Log in to Buy' to authenticated user
 *
 * The bug: useCurrentUser calls /api/users/me without the Authorization header,
 * so Payload's /api/users/me endpoint cannot verify the JWT token and returns null.
 * This causes authenticated users to see "Log in to Buy" instead of the checkout button.
 *
 * The fix: useCurrentUser must read the payload-token cookie and send it as
 * Authorization: JWT <token> header, matching how getMeUser calls /api/users/me.
 */

import '@testing-library/jest-dom'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Track fetch calls for assertion
const fetchCalls: { url: string; options: RequestInit }[] = []
const mockFetch = vi.fn((url: string, options: RequestInit) => {
  fetchCalls.push({ url, options })
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ user: { id: 'test-user-1', email: 'test@example.com' } }),
  } as Response)
})

vi.stubGlobal('fetch', mockFetch)

describe('useCurrentUser', () => {
  afterEach(() => {
    fetchCalls.length = 0
    mockFetch.mockClear()
  })

  it('should send Authorization header when payload-token cookie is present', async () => {
    // Simulate document.cookie having the payload-token
    const cookieValue = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token'
    Object.defineProperty(document, 'cookie', {
      value: `payload-token=${cookieValue}`,
      writable: true,
      configurable: true,
    })

    const { useCurrentUser } = await import('@/client/hooks/useCurrentUser')

    const { result } = renderHook(() => useCurrentUser())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Verify fetch was called with Authorization header
    expect(fetchCalls.length).toBeGreaterThan(0)
    const call = fetchCalls[0]
    expect(call.url).toContain('/api/users/me')
    const headers = call.options.headers
    let authValue: string | null = null
    if (headers instanceof Headers) {
      authValue = headers.get('Authorization')
    } else if (typeof headers === 'object' && headers !== null) {
      authValue = (headers as Record<string, unknown>)['Authorization'] as string | null
    }
    expect(authValue).not.toBeNull()
    expect(typeof authValue === 'string' ? authValue : '').toMatch(/^JWT /)
  })

  it('should still call /api/users/me even without payload-token cookie', async () => {
    // No cookie - useCurrentUser should still try to fetch
    Object.defineProperty(document, 'cookie', {
      value: '',
      writable: true,
      configurable: true,
    })

    const { useCurrentUser } = await import('@/client/hooks/useCurrentUser')

    const { result } = renderHook(() => useCurrentUser())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Should still call the endpoint
    expect(fetchCalls.length).toBeGreaterThan(0)
    const call = fetchCalls[0]
    expect(call.url).toContain('/api/users/me')
  })
})
