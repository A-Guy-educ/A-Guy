// @vitest-environment jsdom
/**
 * AnalyticsProvider Tests
 *
 * Tests that AnalyticsProvider subscribes to SITE_INIT and initializes analytics hooks.
 */

import { AnalyticsProvider } from '@/infra/analytics/AnalyticsProvider'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePageView } from '@/infra/analytics/hooks/usePageView'
import { useSessionDuration } from '@/infra/analytics/hooks/useSessionDuration'
import { usePageAbandonment } from '@/infra/analytics/hooks/usePageAbandonment'

// Mock Next.js router hooks
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => ({
    toString: () => '',
  })),
}))

// Mock analytics hooks
vi.mock('@/infra/analytics/hooks/usePageView', () => ({
  usePageView: vi.fn(),
}))

vi.mock('@/infra/analytics/hooks/useSessionDuration', () => ({
  useSessionDuration: vi.fn(),
}))

vi.mock('@/infra/analytics/hooks/usePageAbandonment', () => ({
  usePageAbandonment: vi.fn(),
}))

describe('AnalyticsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    systemEventBus.reset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('does not initialize analytics before SITE_INIT', () => {
    render(<AnalyticsProvider />)

    expect(usePageView).not.toHaveBeenCalled()
    expect(useSessionDuration).not.toHaveBeenCalled()
    expect(usePageAbandonment).not.toHaveBeenCalled()
  })

  it('initializes analytics after SITE_INIT event', async () => {
    render(<AnalyticsProvider />)

    // Emit SITE_INIT event
    systemEventBus.emit(SYSTEM_EVENTS.SITE_INIT, {})

    // Wait for the component to re-render
    await waitFor(() => {
      expect(usePageView).toHaveBeenCalled()
      expect(useSessionDuration).toHaveBeenCalled()
      expect(usePageAbandonment).toHaveBeenCalled()
    })
  })

  it('subscribes to SITE_INIT event on mount', () => {
    const onSpy = vi.spyOn(systemEventBus, 'on')

    render(<AnalyticsProvider />)

    expect(onSpy).toHaveBeenCalledWith(SYSTEM_EVENTS.SITE_INIT, expect.any(Function))
  })
})
