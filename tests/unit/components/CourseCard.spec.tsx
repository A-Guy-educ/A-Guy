// @vitest-environment jsdom
import { CourseCard } from '@/app/(frontend)/courses/_components/CourseCard'
import type { Course } from '@/payload-types'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import enMessages from '../../../src/i18n/en.json'

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
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
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
  categories: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
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

  it('does not render when course has no slug', () => {
    const courseWithoutSlug = { ...mockCourse, slug: '' }
    const { container } = renderWithI18n(courseWithoutSlug)

    expect(container.firstChild).toBeNull()
  })

  it('updates localStorage and navigates when course is selected', () => {
    renderWithI18n(mockCourse)

    const openButton = screen.getByText(enMessages.courses.openCourse)
    fireEvent.click(openButton)

    // Check localStorage was updated
    const storedProfile = JSON.parse(
      localStorageMock.getItem('a-guy:user-profile') || '{}',
    )
    expect(storedProfile.gradeLevel).toBe('8')
    expect(storedProfile.lastVisit).toBeTruthy()

    // Check navigation was called
    expect(mockPush).toHaveBeenCalledWith('/courses/test-course')
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

    const openButton = screen.getByText(enMessages.courses.openCourse)
    fireEvent.click(openButton)

    // Check mood was preserved
    const storedProfile = JSON.parse(
      localStorageMock.getItem('a-guy:user-profile') || '{}',
    )
    expect(storedProfile.gradeLevel).toBe('8')
    expect(storedProfile.mood).toBe('happy')
  })

  it('uses default grade level when courseLabel is missing', () => {
    const courseWithoutLabel = { ...mockCourse, courseLabel: '' }
    renderWithI18n(courseWithoutLabel)

    const openButton = screen.getByText(enMessages.courses.openCourse)
    fireEvent.click(openButton)

    const storedProfile = JSON.parse(
      localStorageMock.getItem('a-guy:user-profile') || '{}',
    )
    expect(storedProfile.gradeLevel).toBe('8')
  })
})
