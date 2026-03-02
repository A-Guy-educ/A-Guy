// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../src/i18n/en.json'
import heMessages from '../../../src/i18n/he.json'
import { PreferencesSection } from '@/app/(frontend)/account/_components/PreferencesSection'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const renderWithI18n = (component: React.ReactElement, locale: string = 'en') => {
  const messages = locale === 'he' ? heMessages : enMessages
  return render(
    <I18nProvider locale={locale} messages={messages}>
      {component}
    </I18nProvider>,
  )
}

describe('PreferencesSection', () => {
  afterEach(() => {
    cleanup()
  })

  describe('should render the study plan CTA button with correct English text', () => {
    it('should render the link with English text "Build exam study plan"', () => {
      renderWithI18n(<PreferencesSection />, 'en')

      expect(screen.getByRole('link', { name: 'Build exam study plan' })).toBeTruthy()
    })
  })

  describe('should link to /study-plan', () => {
    it('should have href attribute set to /study-plan', () => {
      renderWithI18n(<PreferencesSection />, 'en')

      const link = screen.getByRole('link', { name: 'Build exam study plan' })
      expect(link.getAttribute('href')).toBe('/study-plan')
    })
  })

  describe('should render the Hebrew label when locale is he', () => {
    it('should render the link with Hebrew text when locale is he', () => {
      renderWithI18n(<PreferencesSection />, 'he')

      expect(screen.getByRole('link', { name: 'הכנת תוכנית לימודים לקראת מבחן' })).toBeTruthy()
    })
  })

  describe('should still display the preferences placeholder text', () => {
    it('should render the placeholder text in English', () => {
      renderWithI18n(<PreferencesSection />, 'en')

      expect(screen.getByText('Preferences settings will be available soon.')).toBeTruthy()
    })
  })

  describe('should render button with secondary variant styling', () => {
    it('should have secondary variant class on the button', () => {
      renderWithI18n(<PreferencesSection />, 'en')

      const link = screen.getByRole('link', { name: 'Build exam study plan' })
      // The button with variant="secondary" should have bg-secondary class
      expect(link.className).toContain('bg-secondary')
    })
  })
})
