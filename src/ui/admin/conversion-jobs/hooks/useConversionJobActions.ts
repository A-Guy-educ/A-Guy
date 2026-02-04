/**
 * Hook for conversion job actions with approveAll support
 *
 * @fileType hook
 * @domain admin
 * @pattern action-hook
 * @ai-summary React hook for managing conversion job actions
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

  const approveAll = useCallback(async (jobId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/conversion-jobs/${jobId}/approve-all`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to approve all')
      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const approveStage = useCallback(async (jobId: string, action?: 'approve' | 'skip') => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/conversion-jobs/${jobId}/approve-stage`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!response.ok) throw new Error('Failed to approve stage')
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
    approveAll,
    approveStage,
    isLoading,
    error,
  }
}
