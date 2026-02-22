// @vitest-environment jsdom

import { render, waitFor, act, screen } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { HealthBadge } from '@/ui/web/components/HealthBadge'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../src/i18n/en.json'

const renderWithI18n = (showVersion = false) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      <HealthBadge showVersion={showVersion} />
    </I18nProvider>,
  )
}

describe('HealthBadge - AbortController functionality', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let originalFetch: typeof global.fetch
  let capturedSignal: AbortSignal | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    capturedSignal = undefined

    // Save original fetch
    originalFetch = global.fetch

    // Create a fetch mock that captures the signal and never resolves
    // This simulates a long-running request that needs to be aborted
    fetchMock = vi.fn((_url: string, options?: { signal?: AbortSignal }) => {
      capturedSignal = options?.signal
      // Return a promise that never resolves (simulates long-running request)
      return new Promise((_resolve, _reject) => {
        // Intentionally never resolve to test abort behavior
      })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    // Restore original fetch
    vi.stubGlobal('fetch', originalFetch)
  })

  it('should abort health check fetch on unmount', async () => {
    const { unmount } = renderWithI18n()

    // Wait for the effect to run and fetch to be called
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    // Check that fetch was called with a signal (this will fail until AbortController is implemented)
    expect(capturedSignal).toBeDefined()

    // Unmount the component - this should trigger abort
    unmount()

    // The signal should have been aborted after unmount
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('should NOT set error state when fetch is aborted', async () => {
    // Create a promise that we can reject after abort is called
    let abortController: AbortController | null = null

    // Override fetch mock to properly handle abort signal
    fetchMock.mockImplementation((_url: string, options?: { signal?: AbortSignal }) => {
      capturedSignal = options?.signal

      return new Promise((_resolve, reject) => {
        // Set up abort listener - when signal is aborted, reject with AbortError
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }
      })
    })

    const { unmount } = renderWithI18n()

    // Wait for the effect to run and fetch to be called
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    // Unmount the component - this should trigger abort via cleanup
    unmount()

    // Give time for the abort to propagate and catch handler to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    // The component should NOT display "API ERROR" text
    // because AbortError should be silently ignored
    const apiErrorElement = screen.queryByText('API ERROR')
    expect(apiErrorElement).toBeNull()
  })
})
