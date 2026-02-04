/**
 * Hook for fetching a single conversion job
 *
 * @fileType hook
 * @domain admin
 * @pattern data-fetching-hook
 * @ai-summary React hook for fetching a single conversion job with real-time updates
 */

'use client'

import { useEffect, useState } from 'react'

export interface ConversionJobDetail {
  id: string
  title: string
  status: string
  currentStage: string
  progress: {
    totalSegments: number
    completedSegments: number
    totalExercises: number
    completedExercises: number
  }
  config: {
    segmentSize: number
    segmentOverlap: number
    reviewMode: 'auto' | 'segment' | 'batch' | 'manual'
  }
  lesson?: {
    id: string
    title: string
  }
  sourceMedia?: {
    id: string
    filename: string
  }
  segments?: Array<{
    id: string
    pageRange: { start: number; end: number }
    status: string
    exerciseCount: number
  }>
  pendingExercises?: Array<{
    id: string
    title: string
    status: string
    qualityScores?: {
      confidence: number
      completeness: number
      complexity: number
    }
  }>
  logs?: Array<{
    timestamp: string
    level: 'info' | 'warn' | 'error'
    stage: string
    message: string
  }>
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export function useConversionJob(jobId: string | undefined) {
  const [job, setJob] = useState<ConversionJobDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setIsLoading(false)
      return
    }

    async function fetchJob() {
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
    }

    fetchJob()
  }, [jobId])

  return { job, isLoading, error }
}
