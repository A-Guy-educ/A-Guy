// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * @fileType unit-test
 * @domain admin, exercise-conversion
 * @pattern custom-hook, data-fetching
 * @ai-summary Tests for useConversionPrompts hook
 */

import { useConversionPrompts } from '@/ui/admin/exercise-conversion/hooks/useConversionPrompts'

describe('useConversionPrompts', () => {
  const mockPromptsResponse = {
    extractors: [
      { id: 'ext-1', title: 'Extractor 1', promptKey: 'ext1', usage: 'extractor' },
      { id: 'ext-2', title: 'Extractor 2', promptKey: 'ext2', usage: 'extractor' },
    ],
    verifiers: [{ id: 'ver-1', title: 'Verifier 1', promptKey: 'ver1', usage: 'verifier' }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('fetches prompts on mount', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPromptsResponse,
    })
    global.fetch = fetchSpy

    const { result } = renderHook(() => useConversionPrompts('lesson-1'))

    // Initially loading should be true
    expect(result.current.isLoading).toBe(true)

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Verify fetch was called with correct parameters
    expect(fetchSpy).toHaveBeenCalledWith('/api/prompts/for-conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId: 'lesson-1' }),
      credentials: 'include',
    })

    // Verify extractor prompts are returned
    expect(result.current.extractorPrompts).toHaveLength(2)
    expect(result.current.extractorPrompts[0].id).toBe('ext-1')
    expect(result.current.extractorPrompts[1].id).toBe('ext-2')

    // Verify verifier prompts are returned
    expect(result.current.verifierPrompts).toHaveLength(1)
    expect(result.current.verifierPrompts[0].id).toBe('ver-1')

    // Verify no error
    expect(result.current.error).toBeNull()
  })

  it('returns both extractors and verifiers separately', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPromptsResponse,
    })

    const { result } = renderHook(() => useConversionPrompts('lesson-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const extractorTitles = result.current.extractorPrompts.map((p) => p.title)
    const verifierTitles = result.current.verifierPrompts.map((p) => p.title)

    expect(extractorTitles).toContain('Extractor 1')
    expect(extractorTitles).not.toContain('Verifier 1')
    expect(verifierTitles).toContain('Verifier 1')
    expect(verifierTitles).not.toContain('Extractor 1')
  })

  it('handles fetch error and exposes retry', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('Network error'))
    global.fetch = fetchSpy

    const { result } = renderHook(() => useConversionPrompts('lesson-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Verify error state
    expect(result.current.error).toBe('Failed to load prompts')
    expect(result.current.extractorPrompts).toHaveLength(0)
    expect(result.current.verifierPrompts).toHaveLength(0)

    // Verify retry function exists
    expect(typeof result.current.retry).toBe('function')
  })

  it('retries on error when retry is called', async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPromptsResponse,
      })
    global.fetch = fetchSpy

    const { result } = renderHook(() => useConversionPrompts('lesson-1'))

    // Wait for initial error
    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load prompts')
    })

    // Call retry
    await act(async () => {
      result.current.retry()
    })

    // Wait for retry to succeed
    await waitFor(() => {
      expect(result.current.error).toBeNull()
    })

    expect(result.current.extractorPrompts).toHaveLength(2)
    expect(result.current.verifierPrompts).toHaveLength(1)
  })

  it('handles empty arrays', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ extractors: [], verifiers: [] }),
    })

    const { result } = renderHook(() => useConversionPrompts('lesson-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.extractorPrompts).toHaveLength(0)
    expect(result.current.verifierPrompts).toHaveLength(0)
    expect(result.current.error).toBeNull()
  })

  it('handles failed response (non-ok status)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    const { result } = renderHook(() => useConversionPrompts('lesson-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Failed to load prompts')
    expect(result.current.extractorPrompts).toHaveLength(0)
    expect(result.current.verifierPrompts).toHaveLength(0)
  })
})
