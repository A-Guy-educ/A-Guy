// @vitest-environment jsdom
/**
 * @fileType test
 * @domain frontend
 * @pattern require-course-selection, redirect, guard
 *
 * Bug reproduction test: Issue #1830
 *
 * RequireCourseSelection redirects to '/' when gradeLevel is missing.
 * '/' redirects to '/start' when no home page exists.
 * This creates a confusing UX where users without gradeLevel are sent to /start
 * instead of the course selection page (/courses).
 *
 * Expected: redirect to /courses (where users can select their grade)
 * Actual: redirect to / (which then redirects to /start)
 */

import '@testing-library/jest-dom'
import { cleanup, render, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RequireCourseSelection } from '@/ui/web/guards/RequireCourseSelection'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../src/i18n/en.json'

// Mock the next/navigation module
const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}
vi.stubGlobal('localStorage', localStorageMock)

describe('RequireCourseSelection - Issue #1830 Bug Reproduction', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    localStorageMock.getItem.mockReset()
  })

  it('should redirect to /courses (not /) when gradeLevel is missing', async () => {
    // Mock: no user profile in localStorage (no gradeLevel)
    localStorageMock.getItem.mockReturnValue(null)

    render(
      <I18nProvider locale="en" messages={enMessages}>
        <RequireCourseSelection>
          <div>Protected Content</div>
        </RequireCourseSelection>
      </I18nProvider>,
    )

    // Wait for useEffect to run and redirect
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled()
    })

    // The redirect should be to /courses, NOT to /
    // This is the CORRECT behavior - currently BUGGY: redirects to '/'
    const redirectTarget = mockReplace.mock.calls[0][0]
    expect(redirectTarget).toBe('/courses')
    expect(redirectTarget).not.toBe('/')
  })

  it('should redirect to /courses when gradeLevel is empty string', async () => {
    // Mock: user profile exists but gradeLevel is empty
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify({ gradeLevel: '', lastVisit: new Date().toISOString() }),
    )

    render(
      <I18nProvider locale="en" messages={enMessages}>
        <RequireCourseSelection>
          <div>Protected Content</div>
        </RequireCourseSelection>
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled()
    })

    // The redirect should be to /courses, NOT to /
    const redirectTarget = mockReplace.mock.calls[0][0]
    expect(redirectTarget).toBe('/courses')
    expect(redirectTarget).not.toBe('/')
  })

  it('should render children when gradeLevel exists', async () => {
    // Mock: user profile with gradeLevel
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify({ gradeLevel: '8', lastVisit: new Date().toISOString() }),
    )

    const { getByText } = render(
      <I18nProvider locale="en" messages={enMessages}>
        <RequireCourseSelection>
          <div>Protected Content</div>
        </RequireCourseSelection>
      </I18nProvider>,
    )

    // Wait for useEffect to run
    await waitFor(() => {
      expect(getByText('Protected Content')).toBeInTheDocument()
    })

    // Should NOT have redirected
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
