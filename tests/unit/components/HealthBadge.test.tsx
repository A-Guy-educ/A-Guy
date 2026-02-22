// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HealthBadge } from '@/ui/web/components/HealthBadge'

// Helper to render the component
const renderHealthBadge = () => {
  return render(React.createElement(HealthBadge))
}

describe('HealthBadge - AbortController fix (FR-003, NFR-001, NFR-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('should abort fetch on unmount and NOT update state', async () => {
    // Arrange: Mock fetch with a promise that never resolves (simulating pending request)
    // The component should pass an AbortSignal to the fetch
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise(() => {
          // Never resolve - we want to verify abort is called on unmount
        }),
    )

    // Act: Render component and unmount before fetch completes
    const { unmount } = renderHealthBadge()

    // Wait for fetch to be called
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    // Verify abort signal was passed to fetch
    // This will FAIL because the current implementation doesn't pass any signal
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    )

    // Get the signal that was passed
    const fetchCall = fetchSpy.mock.calls[0]
    const signal = fetchCall[1]?.signal as AbortSignal

    // Unmount the component
    unmount()

    // Assert: AbortController.abort() should have been called
    // The signal should be aborted after unmount
    expect(signal.aborted).toBe(true)
  })

  it('should silently ignore AbortError without logging or updating error state', async () => {
    // Arrange: Mock fetch to reject with AbortError
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))

    // Spy on console.error to verify it's NOT called with abort errors
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Act
    renderHealthBadge()

    // Wait for the component to handle the error
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    // Allow time for any potential state updates
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Assert: console.error should NOT have been called with the abort error
    // This verifies the fix - AbortError should be silently ignored
    // This will FAIL because the current implementation catches ALL errors
    const abortErrorCalls = consoleSpy.mock.calls.filter((call) => {
      const arg = call[0]
      return arg instanceof DOMException && arg.name === 'AbortError'
    })
    expect(abortErrorCalls).toHaveLength(0)

    // Assert: Component should still be in loading state (not error state)
    // This verifies the component didn't set error state for abort
    // This will FAIL because the current implementation shows "API ERROR" for all errors
    const errorElement = screen.queryByText('API ERROR')
    expect(errorElement).toBeNull()

    consoleSpy.mockRestore()
  })

  it('should still handle real network errors normally', async () => {
    // Arrange: Mock fetch to reject with a non-abort network error
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Network error'))

    // Act
    renderHealthBadge()

    // Wait for the component to handle the error
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    // Allow time for state update
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Assert: Component should render error state for real network errors
    // This test should PASS even before the fix - confirms we don't break normal error handling
    const errorElement = screen.getByText('API ERROR')
    expect(errorElement).not.toBeNull()
  })
})
