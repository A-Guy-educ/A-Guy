/**
 * Hook for exercise review actions
 *
 * @fileType hook
 * @domain admin
 * @pattern action-hook
 * @ai-summary React hook for managing exercise review actions (approve, reject, edit, override)
 */

'use client'

import { useCallback, useState } from 'react'

export interface ExerciseReviewState {
  id: string
  title: string
  content: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'edited' | 'skipped'
  scores?: {
    confidence: number
    completeness: number
    complexity: number
    duplicateLikelihood?: number
  }
  verificationResult?: {
    passed: boolean
    message: string
    issues?: string[]
  }
  adminNotes?: string
}

export function useExerciseReview(jobId: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const approveExercise = useCallback(
    async (exerciseIndex: number) => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/conversion-jobs/${jobId}/exercises/${exerciseIndex}/approve`,
          {
            method: 'POST',
            credentials: 'include',
          },
        )
        if (!response.ok) throw new Error('Failed to approve exercise')
        return await response.json()
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [jobId],
  )

  const rejectExercise = useCallback(
    async (exerciseIndex: number, reason: string) => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/conversion-jobs/${jobId}/exercises/${exerciseIndex}/reject`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
          },
        )
        if (!response.ok) throw new Error('Failed to reject exercise')
        return await response.json()
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [jobId],
  )

  const editExercise = useCallback(
    async (
      exerciseIndex: number,
      data: { title?: string; content?: Record<string, unknown>; adminNotes?: string },
    ) => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/conversion-jobs/${jobId}/exercises/${exerciseIndex}/edit`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          },
        )
        if (!response.ok) throw new Error('Failed to edit exercise')
        return await response.json()
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [jobId],
  )

  const overrideVerification = useCallback(
    async (exerciseIndex: number) => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/conversion-jobs/${jobId}/exercises/${exerciseIndex}/override-verification`,
          {
            method: 'POST',
            credentials: 'include',
          },
        )
        if (!response.ok) throw new Error('Failed to override verification')
        return await response.json()
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [jobId],
  )

  return {
    approveExercise,
    rejectExercise,
    editExercise,
    overrideVerification,
    isLoading,
    error,
  }
}
