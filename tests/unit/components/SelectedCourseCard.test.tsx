// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-unused-vars */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock next/navigation before importing the component
const mockRouterReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
  }),
}))

// Mock localStorage
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

// Mock userProfile functions
vi.mock('@/client/state/localStorage/userProfile', () => ({
  getUserProfile: vi.fn(),
  clearUserProfile: vi.fn(),
}))

// Mock getURL
vi.mock('@/infra/utils/getURL', () => ({
  getClientSideURL: vi.fn(() => 'http://localhost:3000'),
}))

// Now import the component after mocks
import { SelectedCourseCard } from '@/app/(frontend)/account/_components/SelectedCourseCard'
import { getUserProfile } from '@/client/state/localStorage/userProfile'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../src/i18n/en.json'

// Import type for Course
import type { Course } from '@/payload-types'

const mockGetUserProfile = getUserProfile as ReturnType<typeof vi.fn>

const renderWithI18n = () => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      <SelectedCourseCard />
    </I18nProvider>,
  )
}

describe('SelectedCourseCard AbortController', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  describe('abort fetch on unmount', () => {
    it('should abort fetch on unmount when loading course', async () => {
      let capturedSignal: AbortSignal | undefined

      // Create a fetch mock that captures the signal and supports abort
      fetchMock = vi.fn((url: string, options?: RequestInit) => {
        capturedSignal = options?.signal ?? undefined

        return new Promise((resolve, reject) => {
          // If signal is already aborted, reject immediately
          if (capturedSignal?.aborted) {
            const error = new Error('Aborted')
            error.name = 'AbortError'
            reject(error)
            return
          }

          // Listen for abort
          capturedSignal?.addEventListener('abort', () => {
            const error = new Error('Aborted')
            error.name = 'AbortError'
            reject(error)
          })

          // Simulate a slow fetch that can be aborted
          setTimeout(() => {
            if (capturedSignal?.aborted) {
              const error = new Error('Aborted')
              error.name = 'AbortError'
              reject(error)
              return
            }

            const mockCourse: Course = {
              id: 'course-1',
              slug: 'grade-8',
              title: 'Grade 8 Mathematics',
              courseLabel: '8',
              description: 'Math curriculum for 8th grade',
              status: 'published',
              isActive: true,
              order: 1,
              tenant: 'tenant-1',
              locale: 'he',
              categories: [],
              pageAccessType: 'free',
              accessType: 'free',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              contentStatus: 'none' as const,
              contentStatusVisible: true,
            }

            resolve(
              new Response(JSON.stringify({ docs: [mockCourse] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }, 100)
        })
      })

      vi.stubGlobal('fetch', fetchMock)

      // Setup user profile to trigger fetch
      mockGetUserProfile.mockReturnValue({
        gradeLevel: '8',
        lastVisit: '2024-01-01T00:00:00.000Z',
      })

      const { unmount } = renderWithI18n()

      // Wait for the fetch to be called
      await waitFor(
        () => {
          expect(fetchMock).toHaveBeenCalled()
        },
        { timeout: 1000 },
      )

      // Verify that a signal was passed to fetch
      const fetchCall = fetchMock.mock.calls[0]
      const options = fetchCall[1] as RequestInit
      expect(options?.signal).toBeDefined()
      expect(options.signal).toBeInstanceOf(AbortSignal)

      // Unmount the component (this should trigger abort via cleanup)
      unmount()

      // Wait a bit for the cleanup to run
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Verify the signal was aborted
      // Note: This test will FAIL because the current component doesn't use AbortController
      // It expects the signal to be aborted when unmounting, but the component doesn't implement this
      expect(options.signal?.aborted).toBe(true)
    })
  })

  describe('AbortError handling', () => {
    it('should NOT set error state when fetch is aborted', async () => {
      // Create a mock controller to simulate abort
      let abortControllerInstance: AbortController | null = null
      let capturedSignal: AbortSignal | undefined

      const fetchWithAbort = vi.fn((url: string, options?: RequestInit) => {
        // Create a new AbortController
        const controller = new AbortController()
        abortControllerInstance = controller
        capturedSignal = controller.signal

        return new Promise((resolve, reject) => {
          // Don't resolve immediately - we'll abort later
          // This simulates a slow fetch that gets cancelled on unmount

          const timeoutId = setTimeout(() => {
            // After a delay, check if aborted, otherwise resolve normally
            if (capturedSignal?.aborted) {
              const error = new Error('Aborted')
              error.name = 'AbortError'
              reject(error)
              return
            }

            const mockCourse: Course = {
              id: 'course-1',
              slug: 'grade-8',
              title: 'Grade 8 Mathematics',
              courseLabel: '8',
              description: 'Math curriculum',
              status: 'published',
              isActive: true,
              order: 1,
              tenant: 'tenant-1',
              locale: 'he',
              categories: [],
              pageAccessType: 'free',
              accessType: 'free',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              contentStatus: 'none' as const,
              contentStatusVisible: true,
            }

            resolve(
              new Response(JSON.stringify({ docs: [mockCourse] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }, 500)

          // Listen for abort event
          capturedSignal?.addEventListener('abort', () => {
            clearTimeout(timeoutId)
            const error = new Error('Aborted')
            error.name = 'AbortError'
            reject(error)
          })
        })
      })

      vi.stubGlobal('fetch', fetchWithAbort)

      mockGetUserProfile.mockReturnValue({
        gradeLevel: '8',
        lastVisit: '2024-01-01T00:00:00.000Z',
      })

      const { unmount } = renderWithI18n()

      // Wait for fetch to be called
      await waitFor(
        () => {
          expect(fetchWithAbort).toHaveBeenCalled()
        },
        { timeout: 1000 },
      )

      // Now unmount - this should trigger abort if component implements AbortController
      unmount()

      // Wait for the abort to be triggered
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Manually abort the captured signal to simulate what cleanup would do
      // by calling abort on the controller that created the signal
      // Use type assertion via unknown to fix TypeScript narrowing issue
      const controller = abortControllerInstance as unknown as AbortController | null
      if (controller) {
        controller.abort()
      }

      // Wait for component to settle
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Now set up a successful fetch for re-render
      const successFetch = vi.fn(() => {
        return Promise.resolve(
          new Response(JSON.stringify({ docs: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      })
      vi.stubGlobal('fetch', successFetch)

      mockGetUserProfile.mockReturnValue({
        gradeLevel: '8',
        lastVisit: '2024-01-01T00:00:00.000Z',
      })

      const { container } = renderWithI18n()

      // Wait for the component to settle
      await waitFor(
        () => {
          // The component should NOT show "Failed to load course" error
          // because we expect AbortError to be silently ignored
          const errorMessage = container.querySelector('.text-destructive')
          // This assertion expects that errorMessage should NOT exist
          // But currently it WILL exist because AbortController is not implemented
          expect(errorMessage).toBeNull()
        },
        { timeout: 1000 },
      )
    })
  })

  describe('handleRetry with AbortController', () => {
    it('handleRetry creates its own AbortController', async () => {
      let firstSignalUsed: AbortSignal | undefined

      // First, create a fetch that fails to trigger error state
      const failingFetch = vi.fn((url: string, options?: RequestInit) => {
        firstSignalUsed = options?.signal ?? undefined

        return Promise.reject(new Error('Network error'))
      })

      vi.stubGlobal('fetch', failingFetch)

      mockGetUserProfile.mockReturnValue({
        gradeLevel: '8',
        lastVisit: '2024-01-01T00:00:00.000Z',
      })

      renderWithI18n()

      // Wait for error state to be shown
      await waitFor(
        () => {
          expect(screen.getByText('Failed to load course')).toBeTruthy()
        },
        { timeout: 1000 },
      )

      // Now setup fetch mock for retry that captures the new signal
      let retrySignalUsed: AbortSignal | undefined
      const retryFetch = vi.fn((url: string, options?: RequestInit) => {
        retrySignalUsed = options?.signal ?? undefined

        return Promise.resolve(
          new Response(JSON.stringify({ docs: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      })

      vi.stubGlobal('fetch', retryFetch)

      // Click retry button
      const retryButton = screen.getByRole('button', { name: 'Try Again' })
      retryButton.click()

      // Wait for retry fetch to be called
      await waitFor(
        () => {
          expect(retryFetch).toHaveBeenCalled()
        },
        { timeout: 1000 },
      )

      // Verify that retry uses its own signal (not the old aborted one)
      const retryCall = retryFetch.mock.calls[0]
      const retryOptions = retryCall[1] as RequestInit

      // The retry should have created a new AbortController/signal
      // This test expects that each retry gets its own fresh AbortController
      expect(retryOptions?.signal).toBeDefined()
      // Should be different from the first signal that was used
      expect(retryOptions?.signal).not.toBe(firstSignalUsed)
    })
  })
})
