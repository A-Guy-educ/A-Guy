/**
 * Hook for fetching a single conversion job with refetch support
 *
 * @fileType hook
 * @domain admin
 * @pattern data-fetching-hook
 * @ai-summary React hook for fetching a single conversion job
 */

'use client'

import { useCallback, useState } from 'react'

export interface ConversionJobDetail {
  id: string
  title: string
  status: string
  // Legacy: root-level fields for backward compatibility
  currentStage?: string
  currentStageMessage?: string
  progress: {
    currentStage?: string
    currentStageMessage?: string
    totalSegments: number
    completedSegments: number
    totalExercises: number
    approvedExercises: number
    rejectedExercises: number
    skippedExercises: number
    completedExercises?: number
  }
  config: {
    pageRange?: { start: number; end?: number; excludePages?: number[] }
    segmentation?: { pagesPerSegment: number }
    extraction?: { mode: string; exerciseTypes?: string[]; customInstructions?: string }
    reviewMode: 'auto' | 'segment' | 'batch' | 'manual'
  }
  lesson?: {
    id: string
    title: string
  }
  sourceMedia?: {
    id: string
    filename: string
    url?: string
  }
  segments?: Array<{
    id: string
    index: number
    pageStart: number
    pageEnd: number
    status: string
    exerciseCount: number
    errorMessage?: string
    processedAt?: string
  }>
  pendingExercises?: Array<{
    id: string
    index?: number
    segmentIndex: number
    orderInSegment: number
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
    enrichments?: Record<string, Record<string, unknown>>
  }>
  completedExercises?: Array<{
    id: string
    title: string
    status: string
    savedExerciseId?: string
  }>
  logs?: Array<{
    timestamp: string
    level: 'info' | 'warn' | 'error'
    stage: string
    message: string
    details?: Record<string, unknown>
  }>
  createdAt: string
  updatedAt: string
  completedAt?: string
  startedAt?: string
  pausedAt?: string
}

export function useConversionJob(jobId: string | undefined) {
  const [job, setJob] = useState<ConversionJobDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!jobId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/conversion-jobs/${jobId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch job: ${response.statusText}`)
      }

      const data = await response.json()
      setJob(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [jobId])

  return { job, isLoading, error, refetch }
}
