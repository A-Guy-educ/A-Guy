// @vitest-environment jsdom
import { LessonCard } from '@/app/(frontend)/courses/_components/LessonCard'
import type { Lesson } from '@/payload-types'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import enMessages from '../../../src/i18n/en.json'

// Mock SystemLink component
vi.mock('@/infra/loading/components/SystemLink', () => ({
  SystemLink: ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string
    children: React.ReactNode
    onClick?: React.MouseEventHandler
    className?: string
  }) => (
    <a href={href} onClick={onClick} className={className} data-testid="system-link">
      {children}
    </a>
  ),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(() => 'mock-toast-id'),
  },
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
      <LessonCard lesson={lesson} courseSlug="test-course" chapterSlug="test-chapter" />
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('LessonCard component', () => {
  describe('baseline rendering', () => {
    it('renders lesson title and basic info', () => {
      renderWithI18n(mockLesson)

      expect(screen.getByText('Test Lesson')).toBeTruthy()
      expect(screen.getByText('Lesson 1')).toBeTruthy()
    })
  })

  describe('contentStatus badge', () => {
    it('renders "Soon" badge when lesson.contentStatus is "soon"', () => {
      const soonLesson = { ...mockLesson, contentStatus: 'soon' as const }
      renderWithI18n(soonLesson)

      expect(screen.getByText('Soon')).toBeTruthy()
    })

    it('renders "New" badge when lesson.contentStatus is "justAdded"', () => {
      const justAddedLesson = { ...mockLesson, contentStatus: 'justAdded' as const }
      renderWithI18n(justAddedLesson)

      expect(screen.getByText('New')).toBeTruthy()
    })

    it('does not render badge when contentStatus is "none"', () => {
      const noStatusLesson = { ...mockLesson, contentStatus: 'none' as const }
      renderWithI18n(noStatusLesson)

      expect(screen.queryByText('Soon')).toBeNull()
      expect(screen.queryByText('New')).toBeNull()
    })

    it('does not render badge when justAdded has expired date', () => {
      const expiredLesson = {
        ...mockLesson,
        contentStatus: 'justAdded' as const,
        contentStatusExpiresAt: '2020-01-01',
      }
      renderWithI18n(expiredLesson)

      expect(screen.queryByText('New')).toBeNull()
    })

    it('renders badge when justAdded has future expiry date', () => {
      const futureLesson = {
        ...mockLesson,
        contentStatus: 'justAdded' as const,
        contentStatusExpiresAt: '2030-01-01',
      }
      renderWithI18n(futureLesson)

      expect(screen.getByText('New')).toBeTruthy()
    })
  })

  describe('locked content behavior', () => {
    it('shows toast when clicking "Soon" lesson', () => {
      const soonLesson = { ...mockLesson, contentStatus: 'soon' as const }
      renderWithI18n(soonLesson)

      // Click the button (not system-link, since locked lessons render standalone button)
      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(toast.info).toHaveBeenCalled()
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('prepared'))
    })

    it('does not render SystemLink when lesson is "Soon"', () => {
      const soonLesson = { ...mockLesson, contentStatus: 'soon' as const }
      renderWithI18n(soonLesson)

      // SystemLink should NOT be rendered for "Soon" lessons
      // Instead, a standalone button is rendered (to avoid invalid <button><a> nesting)
      expect(screen.queryByTestId('system-link')).toBeNull()

      // A button should be rendered instead
      expect(screen.getByRole('button')).toBeTruthy()
    })

    it('renders SystemLink for normal (non-soon) lessons', () => {
      const normalLesson = { ...mockLesson, contentStatus: 'none' as const }
      renderWithI18n(normalLesson)

      expect(screen.getByTestId('system-link')).toBeTruthy()
    })

    it('renders SystemLink for "justAdded" lessons (navigates normally)', () => {
      const justAddedLesson = { ...mockLesson, contentStatus: 'justAdded' as const }
      renderWithI18n(justAddedLesson)

      const link = screen.getByTestId('system-link')
      fireEvent.click(link)

      // Should NOT show toast for justAdded - it should navigate normally
      expect(toast.info).not.toHaveBeenCalled()
      expect(link.getAttribute('href')).toBe(
        '/courses/test-course/chapters/test-chapter/lessons/test-lesson',
      )
    })
  })
})
