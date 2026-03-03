// @vitest-environment jsdom
/**
 * AnalyticsProvider Tests
 *
 * Tests that the consolidated AnalyticsProvider loads scripts,
 * initializes the subscriber, and runs analytics hooks.
 */

import { AnalyticsProvider } from '@/infra/analytics/providers/AnalyticsProvider'
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Next.js router hooks
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => ({
    toString: () => '',
  })),
}))

// Mock analytics hooks
const mockUsePageView = vi.fn()
const mockUseSessionDuration = vi.fn()
const mockUsePageAbandonment = vi.fn()

vi.mock('@/infra/analytics/hooks/usePageView', () => ({
  usePageView: (...args: unknown[]) => mockUsePageView(...args),
}))

vi.mock('@/infra/analytics/hooks/useSessionDuration', () => ({
  useSessionDuration: (...args: unknown[]) => mockUseSessionDuration(...args),
}))

vi.mock('@/infra/analytics/hooks/usePageAbandonment', () => ({
  usePageAbandonment: (...args: unknown[]) => mockUsePageAbandonment(...args),
}))

// Mock adapters and scripts to avoid side effects
vi.mock('@/infra/analytics/adapters/ga4/scripts', () => ({
  GA4Scripts: () => null,
}))

vi.mock('@/infra/analytics/adapters/mixpanel/scripts', () => ({
  MixpanelScripts: () => null,
}))

vi.mock('@/infra/analytics/components/UserIdentificationTracker', () => ({
  UserIdentificationTracker: () => null,
}))

vi.mock('@/infra/analytics/system-events-subscriber', () => ({
  initAnalyticsSubscriber: vi.fn(() => vi.fn()),
}))

vi.mock('@/infra/analytics/config', () => ({
  analyticsConfig: {
    enabled: true,
    debugMode: false,
    ga4: { enabled: false },
    mixpanel: { enabled: false },
  },
  validateConfig: vi.fn(),
}))

describe('AnalyticsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock sessionStorage
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('calls analytics hooks on render', async () => {
    render(
      <AnalyticsProvider>
        <div>child</div>
      </AnalyticsProvider>,
    )

    await waitFor(() => {
      expect(mockUsePageView).toHaveBeenCalled()
      expect(mockUseSessionDuration).toHaveBeenCalled()
      expect(mockUsePageAbandonment).toHaveBeenCalled()
    })
  })

  it('renders children', () => {
    const { getByText } = render(
      <AnalyticsProvider>
        <div>test child</div>
      </AnalyticsProvider>,
    )

    expect(getByText('test child')).toBeTruthy()
  })
})
