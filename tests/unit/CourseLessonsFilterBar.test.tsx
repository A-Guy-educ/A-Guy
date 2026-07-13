// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CourseLessonsFilterBar } from '@/app/(frontend)/courses/[courseSlug]/_components/LessonListTab/CourseLessonsFilterBar'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../src/i18n/en.json'

const renderWithI18n = (props: Parameters<typeof CourseLessonsFilterBar>[0]) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      <CourseLessonsFilterBar {...props} />
    </I18nProvider>,
  )
}

afterEach(() => {
  cleanup()
})

describe('CourseLessonsFilterBar', () => {
  it('renders all three filter modes with the selected one marked', () => {
    renderWithI18n({ value: 'all', onChange: vi.fn(), hasActiveChapter: true })

    const all = screen.getByRole('tab', { name: /Show all/i })
    const focus = screen.getByRole('tab', { name: /Focus/i })
    const hide = screen.getByRole('tab', { name: /Hide completed/i })

    expect(all).toHaveAttribute('aria-selected', 'true')
    expect(focus).toHaveAttribute('aria-selected', 'false')
    expect(hide).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onChange with the clicked mode', () => {
    const onChange = vi.fn()
    renderWithI18n({ value: 'all', onChange, hasActiveChapter: true })

    fireEvent.click(screen.getByRole('tab', { name: /Hide completed/i }))
    expect(onChange).toHaveBeenCalledWith('hideCompleted')
  })

  it('disables the focus tab when there is no active chapter', () => {
    renderWithI18n({ value: 'all', onChange: vi.fn(), hasActiveChapter: false })

    const focus = screen.getByRole('tab', { name: /Focus/i })
    expect(focus).toBeDisabled()
  })
})
