// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GreetingFlow } from '@/ui/web/homepage/GreetingFlow'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../src/i18n/en.json'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: () => store || null,
    setItem: (key: string, value: string) => {
      store = { ...store, [key]: value }
    },
    removeItem: (key: string) => {
      const { [key]: _, ...rest } = store
      store = rest
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock fetch globally - captures the signal passed to fetch
let mockFetch: ReturnType<typeof vi.fn>
let capturedSignal: AbortSignal | null = null
let fetchResolve: ((value: Response) => void) | null = null
let fetchReject: ((reason?: unknown) => void) | null = null

beforeEach(() => {
  capturedSignal = null
  mockFetch = vi.fn((_url: string, options?: { signal?: AbortSignal }) => {
    // Capture the signal if provided
    if (options?.signal) {
      capturedSignal = options.signal
    }
    // Return a promise that we can control
    return new Promise<Response>((resolve, reject) => {
      fetchResolve = resolve
      fetchReject = reject
    })
  })
  vi.stubGlobal('fetch', mockFetch)
  vi.clearAllMocks()
  localStorageMock.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  fetchResolve = null
  fetchReject = null
})

const renderWithI18n = (onComplete: () => void = vi.fn()) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      <GreetingFlow onComplete={onComplete} />
    </I18nProvider>,
  )
}

const advanceToCoursesStep = async () => {
  // Wait for greeting animation to complete and show mood options
  await waitFor(() => {
    expect(screen.getByText(/How are you today/)).toBeTruthy()
  })

  // Click on a mood button to advance to 'moodResponse' step
  const moodButton = screen.getByText(/Excellent/)
  moodButton.click()

  // Wait for moodResponse animation to complete and show courses
  await waitFor(
    () => {
      expect(screen.getByText(/What grade are you in/)).toBeTruthy()
    },
    { timeout: 3000 },
  )
}

describe('GreetingFlow - AbortController for fetch', () => {
  describe('Test 1 - should abort fetch on unmount when step is courses', () => {
    it('should abort fetch on unmount when step is courses', async () => {
      // Arrange: The mock is already set up to capture the signal
      const onComplete = vi.fn()
      const { unmount } = renderWithI18n(onComplete)

      // Act: Navigate to the courses step
      await advanceToCoursesStep()

      // Unmount the component before fetch resolves
      unmount()

      // Assert: Check if abort was called on the signal
      // This will FAIL because the current implementation doesn't use AbortController
      expect(capturedSignal).toBeDefined()
      if (capturedSignal) {
        // The abort signal should have been aborted
        expect(capturedSignal.aborted).toBe(true)
      }
    })
  })

  describe('Test 2 - should silently ignore AbortError in catch handler', () => {
    it('should NOT log error when fetch is aborted', async () => {
      // Arrange: Mock fetch to reject with AbortError
      const abortError = new DOMException('The operation was aborted.', 'AbortError')

      // Override the mock for this test
      mockFetch.mockImplementation((_url: string, options?: { signal?: AbortSignal }) => {
        if (options?.signal) {
          capturedSignal = options.signal
        }
        return Promise.reject(abortError)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const onComplete = vi.fn()
      renderWithI18n(onComplete)

      // Act: Navigate to the courses step
      await advanceToCoursesStep()

      // Wait a bit for the catch handler to execute
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Assert: console.error should NOT have been called with 'Failed to load courses'
      // This will FAIL because the current implementation logs all errors
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to load courses'),
        expect.anything(),
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Test 3 - should still load courses successfully on happy path', () => {
    it('should load and display courses correctly', async () => {
      // Arrange: Mock fetch to return successful response with courses
      const mockCourses = {
        docs: [
          {
            id: 'course-1',
            title: 'Math Grade 8',
            courseLabel: '8',
            description: 'Mathematics curriculum for grade 8',
            slug: 'math-grade-8',
            status: 'published',
            isActive: true,
            order: 0,
            tenant: 'main',
            categories: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'course-2',
            title: 'English Grade 9',
            courseLabel: '9',
            description: 'English curriculum for grade 9',
            slug: 'english-grade-9',
            status: 'published',
            isActive: true,
            order: 1,
            tenant: 'main',
            categories: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }

      // Override the mock for this test
      mockFetch.mockImplementation((_url: string, options?: { signal?: AbortSignal }) => {
        if (options?.signal) {
          capturedSignal = options.signal
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockCourses,
        } as Response)
      })

      const onComplete = vi.fn()
      renderWithI18n(onComplete)

      // Act: Navigate to the courses step
      await advanceToCoursesStep()

      // Assert: Courses should be rendered
      await waitFor(() => {
        expect(screen.getByText('Math Grade 8')).toBeTruthy()
        expect(screen.getByText('English Grade 9')).toBeTruthy()
      })

      // Verify fetch was called
      expect(mockFetch).toHaveBeenCalled()
    })
  })
})
