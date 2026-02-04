/**
 * Unit tests for useConversionJob hook
 */
import { useConversionJob } from '@/ui/admin/conversion-jobs/hooks/useConversionJob'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fetch
global.fetch = vi.fn()

describe('useConversionJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return loading state initially', () => {
    ;(fetch as any).mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useConversionJob('test-id'))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.job).toBeNull()
  })

  it('should fetch job data on mount', async () => {
    const mockJob = {
      id: 'test-id',
      title: 'Test Job',
      status: 'running',
      currentStage: 'extraction',
      progress: {
        totalSegments: 5,
        completedSegments: 2,
        totalExercises: 20,
        approvedExercises: 10,
      },
    }

    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockJob,
    })

    const { result } = renderHook(() => useConversionJob('test-id'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.job).toEqual(mockJob)
    expect(result.current.error).toBeNull()
    expect(fetch).toHaveBeenCalledWith('/api/conversion-jobs/test-id', {
      credentials: 'include',
    })
  })

  it('should handle fetch error', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    })

    const { result } = renderHook(() => useConversionJob('test-id'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.job).toBeNull()
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('should return null job when jobId is undefined', () => {
    const { result } = renderHook(() => useConversionJob(undefined))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.job).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should refetch job data', async () => {
    const mockJob = {
      id: 'test-id',
      title: 'Test Job',
      status: 'completed',
    }

    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockJob,
    })

    const { result } = renderHook(() => useConversionJob('test-id'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const updatedJob = { ...mockJob, status: 'running' }
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => updatedJob,
    })

    await result.current.refetch()

    expect(result.current.job).toEqual(updatedJob)
  })
})
