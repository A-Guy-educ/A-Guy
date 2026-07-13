// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CourseLessonsHero } from '@/app/(frontend)/courses/[courseSlug]/_components/LessonListTab/CourseLessonsHero'
import type { LessonTimelineEntry } from '@/app/(frontend)/courses/[courseSlug]/_components/LessonListTab/lessons-grouping'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../src/i18n/en.json'

const renderWithI18n = (props: Parameters<typeof CourseLessonsHero>[0]) =>
  render(
    <I18nProvider locale="en" messages={enMessages}>
      <CourseLessonsHero {...props} />
    </I18nProvider>,
  )

afterEach(() => cleanup())

const baseEntry: LessonTimelineEntry = {
  lesson: {
    id: 'l1',
    title: 'Next Lesson',
    slug: 'next-lesson',
    chapter: 'chapter-1',
    type: 'learning',
    status: 'published',
    isActive: true,
    order: 1,
    accessType: 'inherit',
    locale: 'he',
    tenant: 't1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    contentStatus: 'none',
    contentStatusVisible: true,
  } as LessonTimelineEntry['lesson'],
  chapter: undefined,
  index: 1,
  progress: 0,
  state: 'active',
}

describe('CourseLessonsHero', () => {
  it('renders the celebratory state when every lesson is completed', () => {
    renderWithI18n({
      overallPercent: 100,
      totalCount: 4,
      completedCount: 4,
      activeEntry: undefined,
      allCompleted: true,
      onFocusNext: vi.fn(),
      onResetProgress: vi.fn(),
    })

    expect(screen.getByText(/All lessons completed/i)).toBeTruthy()
  })

  it('renders the next-lesson title when there is an active entry', () => {
    renderWithI18n({
      overallPercent: 25,
      totalCount: 4,
      completedCount: 1,
      activeEntry: baseEntry,
      allCompleted: false,
      onFocusNext: vi.fn(),
      onResetProgress: vi.fn(),
    })

    expect(screen.getByText(/Next: Next Lesson/)).toBeTruthy()
    expect(screen.getByLabelText('25%')).toBeTruthy()
  })

  it('disables the focus button when there is no active entry', () => {
    renderWithI18n({
      overallPercent: 0,
      totalCount: 0,
      completedCount: 0,
      activeEntry: undefined,
      allCompleted: false,
      onFocusNext: vi.fn(),
      onResetProgress: vi.fn(),
    })

    const focusBtn = screen.getByRole('button', { name: /Scroll to and expand/i })
    expect(focusBtn).toBeDisabled()
  })

  it('disables the reset button when nothing has been completed', () => {
    renderWithI18n({
      overallPercent: 0,
      totalCount: 5,
      completedCount: 0,
      activeEntry: baseEntry,
      allCompleted: false,
      onFocusNext: vi.fn(),
      onResetProgress: vi.fn(),
    })

    const resetBtn = screen.getByRole('button', { name: /Reset course progress/i })
    expect(resetBtn).toBeDisabled()
  })
})
