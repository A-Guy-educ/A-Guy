/**
 * @fileType unit-test
 * @domain components
 * @pattern content-status-badge
 * @ai-summary Tests for ContentStatusBadge component
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ContentStatusBadge } from '@/ui/web/shared/ContentStatusBadge'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../src/i18n/en.json'

const renderWithI18n = (props: {
  contentStatus?: 'none' | 'soon' | 'justAdded' | null
  contentStatusExpiresAt?: string | null
}) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      <ContentStatusBadge {...props} />
    </I18nProvider>,
  )
}

afterEach(() => {
  cleanup()
})

describe('ContentStatusBadge component', () => {
  describe('render behavior', () => {
    it('renders nothing when contentStatus is "none"', () => {
      const { container } = renderWithI18n({ contentStatus: 'none' })
      expect(container.firstChild).toBeNull()
    })

    it('renders nothing when contentStatus is null', () => {
      const { container } = renderWithI18n({ contentStatus: null })
      expect(container.firstChild).toBeNull()
    })

    it('renders nothing when contentStatus is undefined', () => {
      const { container } = renderWithI18n({ contentStatus: undefined })
      expect(container.firstChild).toBeNull()
    })

    it('renders "Soon" badge with correct text for soon status', () => {
      renderWithI18n({ contentStatus: 'soon' })
      expect(screen.getByText('Soon')).toBeTruthy()
    })

    it('renders "New" badge with correct text for justAdded status', () => {
      renderWithI18n({ contentStatus: 'justAdded' })
      expect(screen.getByText('New')).toBeTruthy()
    })

    it('renders nothing when justAdded has expired date (in the past)', () => {
      const pastDate = '2020-01-01'
      const { container } = renderWithI18n({
        contentStatus: 'justAdded',
        contentStatusExpiresAt: pastDate,
      })
      expect(container.firstChild).toBeNull()
    })

    it('renders badge when justAdded has future expiry date', () => {
      const futureDate = '2030-01-01'
      renderWithI18n({
        contentStatus: 'justAdded',
        contentStatusExpiresAt: futureDate,
      })
      expect(screen.getByText('New')).toBeTruthy()
    })
  })

  describe('styling', () => {
    it('"Just Added" badge has animate-pulse class', () => {
      const { container } = renderWithI18n({ contentStatus: 'justAdded' })
      const badge = container.firstChild as HTMLElement
      expect(badge.classList.contains('animate-pulse')).toBe(true)
    })

    it('"Soon" badge does NOT have animate-pulse class', () => {
      const { container } = renderWithI18n({ contentStatus: 'soon' })
      const badge = container.firstChild as HTMLElement
      expect(badge.classList.contains('animate-pulse')).toBe(false)
    })

    it('badge has rounded-full class for pill shape', () => {
      const { container } = renderWithI18n({ contentStatus: 'soon' })
      const badge = container.firstChild as HTMLElement
      expect(badge.classList.contains('rounded-full')).toBe(true)
    })
  })
})
