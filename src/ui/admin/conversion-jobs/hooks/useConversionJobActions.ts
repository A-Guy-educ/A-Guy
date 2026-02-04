/**
 * Hook for conversion job actions
 *
 * @fileType hook
 * @domain admin
 * @pattern action-hook
 * @ai-summary React hook for managing conversion job actions (pause, resume, cancel, retry)
 */

'use client'

import { useCallback, useState } from 'react'

export function useConversionJobActions() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const pauseJob = useCallback(async (jobId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/conversion-jobs/${jobId}/pause`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to pause job')
      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const resumeJob = useCallback(async (jobId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/conversion-jobs/${jobId}/resume`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to resume job')
      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const cancelJob = useCallback(async (jobId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/conversion-jobs/${jobId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to cancel job')
      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const retryJob = useCallback(async (jobId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/conversion-jobs/${jobId}/retry`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to retry job')
      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    pauseJob,
    resumeJob,
    cancelJob,
    retryJob,
    isLoading,
    error,
  }
}
