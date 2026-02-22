// @vitest-environment jsdom

import { SelectedCourseCard } from '@/app/(frontend)/account/_components/SelectedCourseCard'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import enMessages from '../../../src/i18n/en.json'

// Mock localStorage for user profile
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}))

// Mock getClientSideURL
vi.mock('@/infra/utils/getURL', () => ({
  getClientSideURL: () => 'http://localhost:3000',
}))

// Mock userProfile localStorage
vi.mock('@/client/state/localStorage/userProfile', () => ({
  getUserProfile: vi.fn(),
  clearUserProfile: vi.fn(),
}))

// Import after mocks
import { getUserProfile, clearUserProfile } from '@/client/state/localStorage/userProfile'

const mockGetUserProfile = getUserProfile as ReturnType<typeof vi.fn>
const mockClearUserProfile = clearUserProfile as ReturnType<typeof vi.fn>

// Mock fetch
let mockFetch: ReturnType<typeof vi.fn>
let fetchCalls: Array<{ url: string; options?: RequestInit }> = []

beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
  fetchCalls = []

  mockFetch = vi.fn((url: string, options?: RequestInit) => {
    fetchCalls.push({ url: url.toString(), options: options ? { ...options } : undefined })
    return Promise.reject(new Error('No mock provided'))
  })

  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const renderWithI18n = () => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      <SelectedCourseCard />
    </I18nProvider>,
  )
}

describe('SelectedCourseCard - AbortController fix', () => {
  describe('Test 1 - should abort fetch on unmount and not update state', () => {
    it('should abort fetch on unmount and not update state', async () => {
      // Arrange: Mock getUserProfile to return gradeLevel
      mockGetUserProfile.mockReturnValue({ gradeLevel: '8' })

      // Mock fetch to return a never-resolving promise
      let resolveFetch: (value: Response) => void
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve
      })
      mockFetch.mockReturnValue(fetchPromise)

      // Act: Render component
      const { unmount } = renderWithI18n()

      // Wait for initial fetch to be called
      await waitFor(() => {
        expect(fetchCalls.length).toBeGreaterThan(0)
      })

      // Assert: Check that fetch was called with a signal
      const lastCall = fetchCalls[fetchCalls.length - 1]
      expect(lastCall.options).toBeDefined()
      expect(lastCall.options?.signal).toBeDefined()
      expect(lastCall.options?.signal).toBeInstanceOf(AbortSignal)

      // Act: Unmount the component immediately
      unmount()

      // Wait a bit to ensure any async operations would have been processed
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert: The fetch should have been aborted (signal should be aborted)
      // This test FAILS now because the component doesn't pass a signal to fetch
      expect(lastCall.options?.signal?.aborted).toBe(true)
    })
  })

  describe('Test 2 - should silently ignore AbortError without setting error state', () => {
    it('should silently ignore AbortError and not show error state', async () => {
      // Arrange: Mock getUserProfile to return gradeLevel
      mockGetUserProfile.mockReturnValue({ gradeLevel: '8' })

      // Mock fetch to reject with AbortError
      const abortError = new DOMException('The operation was aborted.', 'AbortError')
      mockFetch.mockRejectedValue(abortError)

      // Act: Render component
      renderWithI18n()

      // Wait for fetch to complete
      await waitFor(() => {
        expect(fetchCalls.length).toBeGreaterThan(0)
      })

      // Wait for any state updates
      await waitFor(() => {
        // Should NOT show error state - this will fail because the component
        // currently catches all errors and sets error state
        const errorElement = screen.queryByText('Failed to load course')
        expect(errorElement).toBeNull()
      })
    })
  })

  describe('Test 3 - should still fetch and display course on success', () => {
    it('should display course information when fetch succeeds', async () => {
      // Arrange: Mock getUserProfile to return gradeLevel
      mockGetUserProfile.mockReturnValue({ gradeLevel: '8' })

      // Mock fetch to resolve with a course
      const mockCourseResponse = {
        ok: true,
        json: async () => ({
          docs: [
            {
              id: 'course-1',
              courseLabel: '8',
              title: 'Grade 8 Mathematics',
              description: 'Complete math curriculum for 8th grade',
            },
          ],
        }),
      }
      mockFetch.mockResolvedValue(mockCourseResponse as unknown as Response)

      // Act: Render component
      renderWithI18n()

      // Wait for fetch and render
      await waitFor(() => {
        expect(screen.getByText('Grade 8 Mathematics')).toBeTruthy()
      })

      // Assert: Course is displayed
      expect(screen.getByText('8')).toBeTruthy()
      expect(screen.getByText('Complete math curriculum for 8th grade')).toBeTruthy()
    })
  })

  describe('Test 4 - handleRetry should still work', () => {
    it('should retry fetch when clicking Try Again button', async () => {
      // Arrange: Mock getUserProfile to return gradeLevel
      mockGetUserProfile.mockReturnValue({ gradeLevel: '8' })

      let callCount = 0
      // First call fails, second call succeeds
      mockFetch.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            docs: [
              {
                id: 'course-1',
                courseLabel: '8',
                title: 'Grade 8 Mathematics',
                description: 'Retried course',
              },
            ],
          }),
        }) as unknown as Promise<Response>
      })

      // Act: Render component
      renderWithI18n()

      // Wait for first fetch to fail and error state to show
      await waitFor(() => {
        expect(screen.getByText('Failed to load course')).toBeTruthy()
      })

      // Assert: Try Again button is visible
      const retryButton = screen.getByRole('button', { name: 'Try Again' })
      expect(retryButton).toBeTruthy()

      // Act: Click retry button
      retryButton.click()

      // Wait for retry to succeed
      await waitFor(() => {
        expect(screen.getByText('Grade 8 Mathematics')).toBeTruthy()
      })

      // Assert: Course is displayed after retry
      expect(screen.getByText('Retried course')).toBeTruthy()
    })
  })

  describe('edge cases', () => {
    it('should show not-selected state when no grade level', async () => {
      // Arrange: Mock getUserProfile to return no gradeLevel
      mockGetUserProfile.mockReturnValue(null)

      // Act: Render component
      renderWithI18n()

      // Wait for not-selected state
      await waitFor(() => {
        expect(screen.getByText(enMessages.auth.account.noCourseSelected)).toBeTruthy()
      })

      // Assert: fetch should not have been called
      expect(fetchCalls.length).toBe(0)
    })

    it('should show not-found state when no course matches', async () => {
      // Arrange: Mock getUserProfile to return gradeLevel
      mockGetUserProfile.mockReturnValue({ gradeLevel: '8' })

      // Mock fetch to return empty docs
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ docs: [] }),
      } as unknown as Response)

      // Act: Render component
      renderWithI18n()

      // Wait for not-found state
      await waitFor(() => {
        expect(screen.getByText(enMessages.auth.account.noCourseSelected)).toBeTruthy()
      })
    })
  })
})
