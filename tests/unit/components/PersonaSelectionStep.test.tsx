// @vitest-environment jsdom
/**
 * Unit test for PersonaSelectionStep component loading behavior
 *
 * Bug: The /onboarding/persona page hangs indefinitely on "Loading teacher styles..."
 * spinner because the fetch request never completes or the loading state never resolves.
 *
 * This test verifies that:
 * 1. The component renders in loading state initially
 * 2. The fetch is made to /api/teacher-profiles
 * 3. The loading state resolves after the fetch completes
 * 4. Profiles are displayed when the API returns data
 *
 * The key test is that when the API hangs (never responds), the loading state
 * should still resolve after a timeout. If this test fails, it means the
 * component doesn't handle hanging requests properly.
 */
import { render, waitFor, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PersonaSelectionStep } from '@/app/(frontend)/onboarding/persona/PersonaSelectionStep'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../src/i18n/en.json'

// Mock the dependencies
vi.mock('@/infra/loading/hooks/useRouterWithLoading', () => ({
  useRouterWithLoading: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/infra/loading/components/Spinner', () => ({
  Spinner: ({ size }: { size?: string }) => (
    <div data-testid="spinner" data-size={size}>
      Loading...
    </div>
  ),
}))

const renderWithI18n = (returnTo = '/') => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      <PersonaSelectionStep returnTo={returnTo} />
    </I18nProvider>,
  )
}

describe('PersonaSelectionStep - Loading Behavior (#1592)', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let originalFetch: typeof global.fetch
  let resolveFetch: (value: unknown) => void

  beforeEach(() => {
    vi.clearAllMocks()
    originalFetch = global.fetch

    // Create a controlled fetch mock that we can resolve later
    fetchMock = vi.fn(() => {
      return new Promise((resolve) => {
        resolveFetch = (value: unknown) => resolve(value)
      })
    })
    global.fetch = fetchMock
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('should make fetch request to /api/teacher-profiles on mount', async () => {
    renderWithI18n()

    // Wait for the effect to run and fetch to be called
    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledWith('/api/teacher-profiles')
      },
      { timeout: 2000 },
    )
  })

  it('should resolve loading state after successful API response', async () => {
    const mockProfiles = [
      {
        slug: 'teacher_strict',
        label: 'Strict Teacher',
        description: 'High standards',
        isEnabled: true,
      },
    ]

    renderWithI18n()

    // Initially should show loading
    const spinner = screen.getByTestId('spinner')
    expect(spinner).toBeDefined()

    // Resolve the fetch
    await act(async () => {
      resolveFetch({
        ok: true,
        json: () => Promise.resolve({ profiles: mockProfiles }),
      })
    })

    // After fetch completes, loading should resolve
    await waitFor(
      () => {
        // The spinner should no longer be visible
        const spinnerAfter = screen.queryByTestId('spinner')
        expect(spinnerAfter).toBeNull()
      },
      { timeout: 5000 },
    )

    // Profiles should be displayed
    expect(screen.getByText('Strict Teacher')).toBeDefined()
  })

  it('should show "no profiles" state when API returns empty array', async () => {
    renderWithI18n()

    // Initially should show loading
    expect(screen.getByTestId('spinner')).toBeDefined()

    // Resolve the fetch with empty profiles
    await act(async () => {
      resolveFetch({
        ok: true,
        json: () => Promise.resolve({ profiles: [] }),
      })
    })

    // Wait for loading to resolve
    await waitFor(
      () => {
        const spinnerAfter = screen.queryByTestId('spinner')
        expect(spinnerAfter).toBeNull()
      },
      { timeout: 5000 },
    )

    // Should show "no profiles" state
    expect(screen.getByText(/Teacher styles are currently unavailable/i)).toBeDefined()
  })

  it('should resolve loading state even when fetch fails', async () => {
    renderWithI18n()

    // Initially should show loading
    expect(screen.getByTestId('spinner')).toBeDefined()

    // Resolve the fetch with failed response
    await act(async () => {
      resolveFetch({
        ok: false,
        status: 500,
      })
    })

    // Wait for loading to resolve
    await waitFor(
      () => {
        const spinnerAfter = screen.queryByTestId('spinner')
        expect(spinnerAfter).toBeNull()
      },
      { timeout: 5000 },
    )

    // Should show "no profiles" state since profiles weren't returned
    expect(screen.getByText(/Teacher styles are currently unavailable/i)).toBeDefined()
  })

  it('should resolve loading state even when JSON parsing fails', async () => {
    renderWithI18n()

    // Initially should show loading
    expect(screen.getByTestId('spinner')).toBeDefined()

    // Resolve the fetch with invalid JSON
    await act(async () => {
      resolveFetch({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })
    })

    // Wait for loading to resolve
    await waitFor(
      () => {
        const spinnerAfter = screen.queryByTestId('spinner')
        expect(spinnerAfter).toBeNull()
      },
      { timeout: 5000 },
    )

    // Should show "no profiles" state
    expect(screen.getByText(/Teacher styles are currently unavailable/i)).toBeDefined()
  })

  it('BUG REPRO: should NOT hang when fetch hangs - needs timeout fallback', async () => {
    // This test reproduces the bug where if the fetch hangs indefinitely,
    // the loading spinner never resolves. The component should have a timeout
    // that resolves the loading state even if the fetch never completes.

    // Create a fetch mock that never resolves (simulates hanging request)
    const hangingFetch = vi.fn(() => {
      return new Promise(() => {
        // Never resolves - simulates a hanging request
      })
    })
    global.fetch = hangingFetch

    renderWithI18n()

    // Initially should show loading
    const spinner = screen.getByTestId('spinner')
    expect(spinner).toBeDefined()

    // Wait for a short time - if there's no timeout handling, the loading
    // will never resolve. The component should implement a timeout that
    // resolves loading after a reasonable period (e.g., 30 seconds).
    //
    // This test expects loading to resolve even when fetch hangs.
    // If this test FAILS, it means the component doesn't handle hanging
    // requests properly - the bug that needs to be fixed.
    await waitFor(
      () => {
        const spinnerAfter = screen.queryByTestId('spinner')
        // After 5 seconds, the loading should resolve (with or without profiles)
        // If spinnerAfter is still visible, the component is hung
        expect(spinnerAfter).toBeNull()
      },
      { timeout: 6000 }, // Wait 6 seconds - reasonable timeout for fetch
    )
  })
})
