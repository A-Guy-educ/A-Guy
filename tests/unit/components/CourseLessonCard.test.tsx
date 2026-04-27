// @vitest-environment jsdom
import { CourseLessonCard } from '@/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard'
import type { Lesson } from '@/payload-types'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import enMessages from '../../../src/i18n/en.json'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(() => 'mock-toast-id'),
  },
}))

// Mock loadingManager
vi.mock('@/infra/loading/LoadingManager', () => ({
  loadingManager: { register: vi.fn() },
}))

const mockLesson: Lesson = {
  id: 'test-lesson-1',
  slug: 'test-lesson',
  title: 'Test Lesson',
  chapter: 'chapter-1',
  type: 'learning' as const,
  status: 'published',
  isActive: true,
  order: 1,
  accessType: 'inherit' as const,
  locale: 'he' as const,
  tenant: 'test-tenant',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  contentStatus: 'none' as const,
  contentStatusVisible: true,
}

const renderWithI18n = (lesson: Lesson) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      <CourseLessonCard
        lesson={lesson}
        index={1}
        courseSlug="test-course"
        chapterSlug="test-chapter"
      />
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('CourseLessonCard component', () => {
  describe('baseline rendering', () => {
    it('renders lesson title and basic info', () => {
      renderWithI18n(mockLesson)

      expect(screen.getByText('Test Lesson')).toBeTruthy()
      expect(screen.getByText('Lesson 1')).toBeTruthy()
    })
  })

  describe('contentStatus badge', () => {
    it('renders "Soon" badge for soon status', () => {
      const soonLesson = { ...mockLesson, contentStatus: 'soon' as const }
      renderWithI18n(soonLesson)

      expect(screen.getByText('Soon')).toBeTruthy()
    })

    it('renders "New" badge for justAdded status', () => {
      const justAddedLesson = { ...mockLesson, contentStatus: 'justAdded' as const }
      renderWithI18n(justAddedLesson)

      expect(screen.getByText('New')).toBeTruthy()
    })

    it('does not render badge when contentStatus is none/undefined', () => {
      // Use 'none' which is the default - this tests that the badge doesn't render
      const noStatusLesson = { ...mockLesson, contentStatus: 'none' as const }
      renderWithI18n(noStatusLesson)

      expect(screen.queryByText('Soon')).toBeNull()
      expect(screen.queryByText('New')).toBeNull()
    })
  })

  describe('locked content behavior', () => {
    it('prevents navigation on click when lesson is "Soon"', async () => {
      const soonLesson = { ...mockLesson, contentStatus: 'soon' as const }
      renderWithI18n(soonLesson)

      const link = screen.getByRole('link')
      fireEvent.click(link)

      expect(toast.info).toHaveBeenCalled()
      // Verify toast was called with the locked message
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('prepared'))
    })

    it('allows navigation for "Just Added" lesson', () => {
      const justAddedLesson = { ...mockLesson, contentStatus: 'justAdded' as const }
      renderWithI18n(justAddedLesson)

      const link = screen.getByRole('link')
      fireEvent.click(link)

      // Should NOT show toast for justAdded - it should navigate normally
      expect(toast.info).not.toHaveBeenCalled()
    })
  })

  describe('exam label', () => {
    it('shows "Exam 1" when lessonType is "exam"', () => {
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <CourseLessonCard
            lesson={mockLesson}
            index={1}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            lessonType="exam"
          />
        </I18nProvider>,
      )
      expect(screen.getByText('Exam 1')).toBeTruthy()
    })

    it('shows "Lesson 1" when lessonType is "learning"', () => {
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <CourseLessonCard
            lesson={mockLesson}
            index={1}
            courseSlug="test-course"
            chapterSlug="test-chapter"
            lessonType="learning"
          />
        </I18nProvider>,
      )
      expect(screen.getByText('Lesson 1')).toBeTruthy()
    })

    it('shows "Lesson 1" when lessonType is omitted (backward compat)', () => {
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <CourseLessonCard
            lesson={mockLesson}
            index={1}
            courseSlug="test-course"
            chapterSlug="test-chapter"
          />
        </I18nProvider>,
      )
      expect(screen.getByText('Lesson 1')).toBeTruthy()
    })
  })
})
