/**
 * Hook for fetching conversion jobs
 *
 * @fileType hook
 * @domain admin
 * @pattern data-fetching-hook
 * @ai-summary React hook for fetching and managing conversion jobs
 */

'use client'

import { useEffect, useState } from 'react'

export interface ConversionJob {
  id: string
  title: string
  status:
    | 'draft'
    | 'queued'
    | 'running'
    | 'paused'
    | 'review'
    | 'completed'
    | 'failed'
    | 'cancelled'
  // Legacy: root-level for backward compatibility
  currentStage?: string
  progress: {
    currentStage?: string
    totalSegments: number
    completedSegments: number
    totalExercises: number
    completedExercises: number
  }
  lesson?: {
    id: string
    title: string
  }
  sourceMedia?: {
    id: string
    filename: string
  }
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface ConversionJobsResponse {
  docs: ConversionJob[]
  totalDocs: number
  totalPages: number
  page: number
}

export interface UseConversionJobsOptions {
  status?: string
  page?: number
  limit?: number
}

export function useConversionJobs(options: UseConversionJobsOptions = {}) {
  const { status = 'all', page = 1, limit = 20 } = options
  const [data, setData] = useState<ConversionJobsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchJobs() {
      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        })

        if (status !== 'all') {
          params.append('where[status]', status)
        }

        const response = await fetch(`/api/conversion-jobs?${params}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch jobs: ${response.statusText}`)
        }

        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchJobs()
  }, [status, page, limit])

  return { data, isLoading, error, refetch: () => {} }
}
