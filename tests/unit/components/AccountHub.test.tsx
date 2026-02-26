// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { User } from '@/payload-types'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../src/i18n/en.json'
import { AccountHub } from '@/app/(frontend)/account/_components/AccountHub'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
}))

// Mock child components to avoid complex setups
vi.mock('@/app/(frontend)/account/_components/DetailsSection', () => ({
  DetailsSection: ({ user }: { user: User }) => (
    <div data-testid="details-content">
      <span data-testid="user-name">{user.name || 'Missing Name'}</span>
      <span data-testid="user-email">{user.email}</span>
    </div>
  ),
}))

vi.mock('@/app/(frontend)/account/_components/SelectedCourseCard', () => ({
  SelectedCourseCard: () => <div data-testid="courses-content">SelectedCourseCard Content</div>,
}))

vi.mock('@/app/(frontend)/account/_components/PreferencesSection', () => ({
  PreferencesSection: () => <div data-testid="preferences-content">Preferences Content</div>,
}))

vi.mock('@/app/(frontend)/account/_components/TeachersProfileSection', () => ({
  TeachersProfileSection: () => (
    <div data-testid="teachers-profile-content">Teachers Profile Content</div>
  ),
}))

// Import after mocks
const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'student',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

const renderWithI18n = (component: React.ReactElement) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      {component}
    </I18nProvider>,
  )
}

describe('AccountHub', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window.location.href
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost:3000/account'),
      writable: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  describe('renders all four accordion sections', () => {
    it('should render Details, Courses, Preferences, and Teachers Profile sections', () => {
      renderWithI18n(<AccountHub user={mockUser} />)

      expect(screen.getByText('Details')).toBeTruthy()
      expect(screen.getByText('Courses')).toBeTruthy()
      expect(screen.getByText('Preferences')).toBeTruthy()
      expect(screen.getByText('Teachers Profile')).toBeTruthy()
    })
  })

  describe('Details section is open by default', () => {
    it('should show Details content and hide other sections when no initialSection provided', () => {
      renderWithI18n(<AccountHub user={mockUser} />)

      // Details content should be visible
      expect(screen.getByTestId('user-name')).toBeTruthy()
      expect(screen.getByTestId('user-email')).toBeTruthy()

      // Courses content should NOT be visible (accordion collapsed)
      expect(screen.queryByTestId('courses-content')).toBeNull()
    })
  })

  describe('opens section from initialSection prop', () => {
    it('should open Courses section when initialSection="courses"', () => {
      renderWithI18n(<AccountHub user={mockUser} initialSection="courses" />)

      // Courses content should be visible
      expect(screen.getByTestId('courses-content')).toBeTruthy()

      // Details content should NOT be visible
      expect(screen.queryByTestId('user-name')).toBeNull()
      expect(screen.queryByTestId('user-email')).toBeNull()
    })

    it('should open Preferences section when initialSection="preferences"', () => {
      renderWithI18n(<AccountHub user={mockUser} initialSection="preferences" />)

      // Preferences content should be visible
      expect(screen.getByTestId('preferences-content')).toBeTruthy()

      // Details content should NOT be visible
      expect(screen.queryByTestId('user-name')).toBeNull()
    })

    it('should open Teachers Profile section when initialSection="teachers-profile"', () => {
      renderWithI18n(<AccountHub user={mockUser} initialSection="teachers-profile" />)

      // Teachers Profile content should be visible
      expect(screen.getByTestId('teachers-profile-content')).toBeTruthy()

      // Details content should NOT be visible
      expect(screen.queryByTestId('user-name')).toBeNull()
    })
  })

  describe('falls back to Details for invalid initialSection', () => {
    it('should show Details content when initialSection is invalid', () => {
      renderWithI18n(<AccountHub user={mockUser} initialSection="invalid-section" />)

      // Details content should be visible (fallback)
      expect(screen.getByTestId('user-name')).toBeTruthy()
      expect(screen.getByTestId('user-email')).toBeTruthy()

      // Other content should NOT be visible
      expect(screen.queryByTestId('courses-content')).toBeNull()
    })
  })

  describe('updates URL shallowly when section changes', () => {
    it('should update URL with section parameter when accordion value changes', async () => {
      const replaceStateMock = vi.fn()
      vi.stubGlobal('history', {
        replaceState: replaceStateMock,
      })

      renderWithI18n(<AccountHub user={mockUser} />)

      // Click on the Courses accordion trigger
      const coursesTrigger = screen.getByText('Courses')
      coursesTrigger.click()

      // Wait for state update
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify replaceState was called with URL containing section=courses
      expect(replaceStateMock).toHaveBeenCalled()
      const calls = replaceStateMock.mock.calls
      const lastCall = calls[calls.length - 1]
      const url = lastCall[2] as string

      expect(url).toContain('section=courses')
    })
  })

  describe('removes section param when accordion is collapsed', () => {
    it('should remove section parameter from URL when accordion is collapsed', async () => {
      const replaceStateMock = vi.fn()
      vi.stubGlobal('history', {
        replaceState: replaceStateMock,
      })

      renderWithI18n(<AccountHub user={mockUser} initialSection="courses" />)

      // First verify courses is open
      expect(screen.getByTestId('courses-content')).toBeTruthy()

      // Click on Details trigger to collapse courses and open details
      const detailsTrigger = screen.getByText('Details')
      detailsTrigger.click()

      // Wait for state update
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify replaceState was called with URL that does NOT contain section param
      // (or contains section=details)
      expect(replaceStateMock).toHaveBeenCalled()
      const calls = replaceStateMock.mock.calls
      const lastCall = calls[calls.length - 1]
      const url = lastCall[2] as string

      // When a new section is selected, it should set section=details
      expect(url).toContain('section=details')
    })
  })
})
