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
 * Resolves the active mode from a stored preference and a list of allowed modes.
 * Falls back through the priority list when the stored mode is not allowed.
 */
function resolveEffectiveMode(
  stored: LessonMode | null,
  allowedModes: LessonMode[] | undefined,
): LessonMode {
  if (!allowedModes) return stored ?? 'pdf'
  if (stored && allowedModes.includes(stored)) return stored
  const priority: LessonMode[] = ['media', 'pdf', 'interactive']
  for (const mode of priority) {
    if (allowedModes.includes(mode)) return mode
  }
  return 'pdf' // Safety fallback — beforeChange validation prevents this being reached
}

/**
 * Tracks the active dual-mode tab for a lesson, defaulting to 'pdf' and
 * persisting the student's choice in localStorage keyed by lesson id.
 * Hydrates from storage after mount to avoid SSR mismatch.
 *
 * @param lessonId  - The unique lesson identifier, used as localStorage key.
 * @param allowedModes - Optional list of modes the admin has enabled. When
 *                      provided, the stored preference is promoted to the first
 *                      allowed mode if the stored mode is now disabled.
 */
export function useLessonViewMode(lessonId: string, allowedModes?: LessonMode[]) {
  const [mode, setMode] = useState<LessonMode>('pdf')

  useEffect(() => {
    const stored = readStoredMode(lessonId)
    const resolved = resolveEffectiveMode(stored, allowedModes)
    setMode(resolved)
  }, [lessonId, allowedModes])

  const select = useCallback(
    (next: LessonMode) => {
      // Only persist and switch if the target mode is currently allowed.
      // This is a no-op when the tab doesn't exist in the UI.
      if (!allowedModes || allowedModes.includes(next)) {
        setMode(next)
        writeStoredMode(lessonId, next)
      }
    },
    [lessonId, allowedModes],
  )

  return [mode, select] as const
}
