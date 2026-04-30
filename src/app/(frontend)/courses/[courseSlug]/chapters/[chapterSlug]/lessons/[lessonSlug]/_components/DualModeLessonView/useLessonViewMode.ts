'use client'

import { useCallback, useEffect, useState } from 'react'

export type LessonMode = 'media' | 'pdf' | 'interactive'

const STORAGE_PREFIX = 'lesson-view-mode:'

function readStoredMode(lessonId: string): LessonMode | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${lessonId}`)
    return raw === 'media' || raw === 'pdf' || raw === 'interactive' ? raw : null
  } catch {
    return null
  }
}

function writeStoredMode(lessonId: string, mode: LessonMode) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${lessonId}`, mode)
  } catch {
    // Storage may be unavailable (private mode, quota) — silently ignore.
  }
}

/**
 * Tracks the active dual-mode tab for a lesson, defaulting to 'pdf' and
 * persisting the student's choice in localStorage keyed by lesson id.
 * Hydrates from storage after mount to avoid SSR mismatch.
 */
export function useLessonViewMode(lessonId: string) {
  const [mode, setMode] = useState<LessonMode>('pdf')

  useEffect(() => {
    // Always sync from storage when lessonId changes — including resetting
    // back to 'pdf' when a newly-mounted lesson has no stored preference.
    // A conditional `if (stored !== 'pdf') setMode(stored)` would leak
    // 'interactive' state from a previous lesson into a fresh one if the
    // hook instance is reused across lessons (SPA navigation).
    const stored = readStoredMode(lessonId)
    setMode(stored ?? 'pdf')
  }, [lessonId])

  const select = useCallback(
    (next: LessonMode) => {
      setMode(next)
      writeStoredMode(lessonId, next)
    },
    [lessonId],
  )

  return [mode, select] as const
}
