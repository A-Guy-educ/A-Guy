// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'

describe('useCurrentUser', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sets isLoading true on mount and resolves user on success', async () => {
    const mockUser = { id: '1', email: 'admin@test.com', role: 'admin' }
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    })

    const { result } = renderHook(() => useCurrentUser())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.user).toBe(null)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user).toMatchObject(mockUser)
    expect(result.current.error).toBe(null)
  })

  it('sets user to null on non-ok response', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
    })

    const { result } = renderHook(() => useCurrentUser())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user).toBe(null)
    expect(result.current.error).toBe(null)
  })

  it('sets isLoading to false and sets error when fetch times out (does not hang)', async () => {
    // Mock fetch to reject with AbortError (simulates the timeout abort)
    const abortError = new Error('The user aborted a request.')
    abortError.name = 'AbortError'
    ;(fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(abortError)

    const { result } = renderHook(() => useCurrentUser())

    // isLoading starts true
    expect(result.current.isLoading).toBe(true)

    // Wait for loading to become false
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Error should indicate timeout
    expect(result.current.user).toBe(null)
    expect(result.current.error?.message).toBe('Request timed out')
  })
})
