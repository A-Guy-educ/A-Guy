'use client'

import { useEffect, useMemo, useState } from 'react'
import { getUserProfile } from '@/client/state/localStorage/userProfile'

interface ProgressEntry {
  completionPercentage: number
  status: string
  score?: number
}

interface UseProgressMapResult {
  /** recordId → completionPercentage (0-100) */
  progressMap: Record<string, number>
  /** recordId → status ('not_started' | 'in_progress' | 'completed') */
  statusMap: Record<string, string>
  isLoading: boolean
}

const EMPTY_RESULT: UseProgressMapResult = {
  progressMap: {},
  statusMap: {},
  isLoading: false,
}

/**
 * Batch-fetch progress for a list of record IDs.
 * Returns empty maps for unauthenticated users.
 *
 * `gradeLevel` should be the *content's* grade bucket (e.g. course.courseLabel),
 * not the user's onboarding grade. When omitted, falls back to the user-profile
 * grade in localStorage — only correct for dashboards that key off the active
 * profile (e.g. /study).
 */
export function useProgressMap({
  recordType,
  recordIds,
  gradeLevel: gradeLevelOverride,
}: {
  recordType: 'lesson' | 'exercise' | 'chapter'
  recordIds: string[]
  gradeLevel?: string
}): UseProgressMapResult {
  const [data, setData] = useState<Record<string, ProgressEntry>>({})
  const [isLoading, setIsLoading] = useState(false)

  // Stable key for the recordIds array to avoid unnecessary refetches
  const idsKey = useMemo(() => [...recordIds].sort().join(','), [recordIds])

  useEffect(() => {
    if (!idsKey) return

    const gradeLevel = gradeLevelOverride ?? getUserProfile()?.gradeLevel
    if (!gradeLevel) return

    const controller = new AbortController()
    setIsLoading(true)

    fetch(
      `/api/progress?gradeLevel=${encodeURIComponent(gradeLevel)}&recordType=${recordType}&recordIds=${encodeURIComponent(idsKey)}`,
      { credentials: 'include', signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) return null
        return res.json()
      })
      .then((json: { success?: boolean; data?: Record<string, ProgressEntry> } | null) => {
        if (json?.data) setData(json.data)
      })
      .catch(() => {
        /* silent – user may be anonymous or request aborted */
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [idsKey, recordType, gradeLevelOverride])

  return useMemo(() => {
    if (!idsKey) return EMPTY_RESULT

    const progressMap: Record<string, number> = {}
    const statusMap: Record<string, string> = {}

    for (const [id, entry] of Object.entries(data)) {
      progressMap[id] = entry.completionPercentage
      statusMap[id] = entry.status
    }

    return { progressMap, statusMap, isLoading }
  }, [data, isLoading, idsKey])
}
