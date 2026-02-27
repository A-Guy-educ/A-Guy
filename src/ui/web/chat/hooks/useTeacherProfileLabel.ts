'use client'

import { useEffect, useState } from 'react'

interface TeacherProfileLabel {
  label: string | null
  isLoading: boolean
}

/**
 * Fetches the authenticated user's selected teacher profile label.
 * Returns null for guests or when no profile is selected.
 */
export function useTeacherProfileLabel(isAuthenticated: boolean): TeacherProfileLabel {
  const [label, setLabel] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setLabel(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)

    const doFetch = async () => {
      try {
        const res = await fetch('/api/user-settings', {
          credentials: 'include',
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        if (!res.ok) {
          setLabel(null)
          return
        }
        const data = await res.json()
        if (controller.signal.aborted) return
        setLabel(data.settings?.teacherProfile?.label ?? null)
      } catch {
        if (!controller.signal.aborted) setLabel(null)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    doFetch()
    return () => controller.abort()
  }, [isAuthenticated])

  return { label, isLoading }
}
