// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLessonViewMode } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/DualModeLessonView/useLessonViewMode'

const STORAGE_KEY = (lessonId: string) => `lesson-view-mode:${lessonId}`

describe('useLessonViewMode', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to "pdf" on first mount with empty storage', () => {
    const { result } = renderHook(() => useLessonViewMode('lesson-1'))
    const [mode] = result.current
    expect(mode).toBe('pdf')
  })

  it('hydrates from localStorage when a previous choice exists', () => {
    window.localStorage.setItem(STORAGE_KEY('lesson-2'), 'interactive')
    const { result } = renderHook(() => useLessonViewMode('lesson-2'))
    const [mode] = result.current
    expect(mode).toBe('interactive')
  })

  it('ignores corrupted / unrecognised values in storage and keeps default', () => {
    window.localStorage.setItem(STORAGE_KEY('lesson-3'), 'garbage')
    const { result } = renderHook(() => useLessonViewMode('lesson-3'))
    expect(result.current[0]).toBe('pdf')
  })

  it('persists the new choice to localStorage on select()', () => {
    const { result } = renderHook(() => useLessonViewMode('lesson-4'))
    act(() => {
      result.current[1]('interactive')
    })
    expect(result.current[0]).toBe('interactive')
    expect(window.localStorage.getItem(STORAGE_KEY('lesson-4'))).toBe('interactive')
  })

  it('keeps choices isolated per lesson id', () => {
    const a = renderHook(() => useLessonViewMode('lesson-A'))
    const b = renderHook(() => useLessonViewMode('lesson-B'))

    act(() => {
      a.result.current[1]('interactive')
    })
    // Flipping lesson-A's storage must not leak into lesson-B's stored value.
    expect(window.localStorage.getItem(STORAGE_KEY('lesson-A'))).toBe('interactive')
    expect(window.localStorage.getItem(STORAGE_KEY('lesson-B'))).toBeNull()
    // lesson-B's mode remains the default.
    expect(b.result.current[0]).toBe('pdf')
  })

  it('resets to "pdf" when lessonId changes to a lesson with no stored preference', () => {
    // Seed only lesson-X with 'interactive'.
    window.localStorage.setItem(STORAGE_KEY('lesson-X'), 'interactive')

    let currentLessonId = 'lesson-X'
    const { result, rerender } = renderHook(() => useLessonViewMode(currentLessonId))

    // Hydrates from storage → 'interactive'.
    expect(result.current[0]).toBe('interactive')

    // Switch to a lesson with no stored preference. The effect must actively
    // reset to the default 'pdf' — not retain the previous lesson's mode.
    currentLessonId = 'lesson-Y'
    rerender()
    expect(result.current[0]).toBe('pdf')
  })

  it('still toggles state when localStorage.setItem throws (quota/private mode)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })

    const { result } = renderHook(() => useLessonViewMode('lesson-5'))
    act(() => {
      result.current[1]('interactive')
    })
    // State still flipped — the write failure is swallowed.
    expect(result.current[0]).toBe('interactive')
    expect(setItemSpy).toHaveBeenCalled()
  })
})
