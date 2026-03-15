// @vitest-environment jsdom
import { CourseCard } from '@/app/(frontend)/courses/_components/CourseCard'
import type { Course } from '@/payload-types'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import enMessages from '../../../src/i18n/en.json'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: vi.fn(),
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

// Mock next/navigation
const mockPush = vi.fn()
const mockPathname = '/'
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}))

const mockCourse: Course = {
  id: 'test-course-1',
  slug: 'test-course',
  title: 'Test Course',
  courseLabel: '8',
  description: 'A test course for unit testing',
  status: 'published',
  isActive: true,
  order: 0,
  tenant: 'test-tenant-id',
  locale: 'he',
  categories: [],
  pageAccessType: 'free' as const,
  accessType: 'free' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  contentStatus: 'none' as const,
  contentStatusVisible: true,
}

const renderWithI18n = (course: Course) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      <CourseCard course={course} />
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
})

describe('CourseCard component', () => {
  it('renders course information correctly', () => {
    renderWithI18n(mockCourse)

    expect(screen.getByText('Test Course')).toBeTruthy()
    expect(screen.getByText('A test course for unit testing')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
  })

  it('updates localStorage and navigates when course is selected', () => {
    renderWithI18n(mockCourse)

    const openButton = screen.getAllByRole('button', { name: enMessages.courses.openCourse })[0]
    fireEvent.click(openButton)

    // Check localStorage was updated
    const storedProfile = JSON.parse(localStorageMock.getItem('a-guy:user-profile') || '{}')
    expect(storedProfile.gradeLevel).toBe('8')
    expect(storedProfile.lastVisit).toBeTruthy()

    // Check navigation was called (second arg is optional navigation options)
    expect(mockPush).toHaveBeenCalledWith('/', undefined)
  })

  it('preserves existing mood when updating localStorage', () => {
    // Set existing profile with mood
    localStorageMock.setItem(
      'a-guy:user-profile',
      JSON.stringify({
        gradeLevel: '7',
        mood: 'happy',
        lastVisit: '2024-01-01T00:00:00.000Z',
      }),
    )

    renderWithI18n(mockCourse)

    const openButton = screen.getAllByRole('button', { name: enMessages.courses.openCourse })[0]
    fireEvent.click(openButton)

    // Check mood was preserved
    const storedProfile = JSON.parse(localStorageMock.getItem('a-guy:user-profile') || '{}')
    expect(storedProfile.gradeLevel).toBe('8')
    expect(storedProfile.mood).toBe('happy')
  })

  it('uses default grade level when courseLabel is missing', () => {
    const courseWithoutLabel = { ...mockCourse, courseLabel: '' }
    renderWithI18n(courseWithoutLabel)

    const openButton = screen.getAllByRole('button', { name: enMessages.courses.openCourse })[0]
    fireEvent.click(openButton)

    const storedProfile = JSON.parse(localStorageMock.getItem('a-guy:user-profile') || '{}')
    expect(storedProfile.gradeLevel).toBe('8')
  })
})

describe('CourseCard content status badges', () => {
  it('renders "Soon" badge when course.contentStatus is "soon"', () => {
    const soonCourse = { ...mockCourse, contentStatus: 'soon' as const }
    renderWithI18n(soonCourse)

    expect(screen.getByText('Soon')).toBeTruthy()
  })

  it('renders "New" badge when course.contentStatus is "justAdded"', () => {
    const justAddedCourse = { ...mockCourse, contentStatus: 'justAdded' as const }
    renderWithI18n(justAddedCourse)

    expect(screen.getByText('New')).toBeTruthy()
  })

  it('does not render badge when contentStatus is "none" or undefined', () => {
    // Use 'none' which is the default - this tests that the badge doesn't render
    const noStatusCourse = { ...mockCourse, contentStatus: 'none' as const }
    renderWithI18n(noStatusCourse)

    expect(screen.queryByText('Soon')).toBeNull()
    expect(screen.queryByText('New')).toBeNull()
  })

  it('does NOT navigate when clicking a "Soon" course', async () => {
    const { toast } = await import('sonner')
    const soonCourse = { ...mockCourse, contentStatus: 'soon' as const }
    renderWithI18n(soonCourse)

    const openButton = screen.getAllByRole('button', { name: enMessages.courses.openCourse })[0]
    fireEvent.click(openButton)

    // Navigation should NOT have been called
    expect(mockPush).not.toHaveBeenCalled()

    // Toast should have been shown
    expect(toast).toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('prepared'))
  })

  it('navigates normally when course.contentStatus is "justAdded"', () => {
    const justAddedCourse = { ...mockCourse, contentStatus: 'justAdded' as const }
    renderWithI18n(justAddedCourse)

    const openButton = screen.getAllByRole('button', { name: enMessages.courses.openCourse })[0]
    fireEvent.click(openButton)

    // Navigation should have been called
    expect(mockPush).toHaveBeenCalledWith('/', undefined)
  })

  it('does not render badge when justAdded has expired date', () => {
    const expiredCourse = {
      ...mockCourse,
      contentStatus: 'justAdded' as const,
      contentStatusExpiresAt: '2020-01-01',
    }
    renderWithI18n(expiredCourse)

    expect(screen.queryByText('New')).toBeNull()
  })

  it('renders badge when justAdded has future expiry date', () => {
    const futureCourse = {
      ...mockCourse,
      contentStatus: 'justAdded' as const,
      contentStatusExpiresAt: '2030-01-01',
    }
    renderWithI18n(futureCourse)

    expect(screen.getByText('New')).toBeTruthy()
  })
})
