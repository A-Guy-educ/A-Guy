'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Prompt option from the API
 */
export interface PromptOption {
  id: string
  title: string
  promptKey: string
  usage: string
}

/**
 * Result from the useExtractorPrompts hook
 */
export interface UseExtractorPromptsResult {
  extractorPrompts: PromptOption[]
  isLoading: boolean
  error: string | null
  retry: () => void
}

/**
 * Custom hook to fetch extractor prompts for exercise conversion.
 *
 * Fetches prompts from /api/prompts/for-conversion and filters to return only
 * extractor prompts (not verifiers).
 *
 * @param lessonId - The ID of the lesson to fetch prompts for
 * @returns Object containing extractor prompts, loading state, error state, and retry function
 */
export function useExtractorPrompts(lessonId: string): UseExtractorPromptsResult {
  const [extractorPrompts, setExtractorPrompts] = useState<PromptOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPrompts = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/prompts/for-conversion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lessonId }),
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load prompts')
      }

      const data = await response.json()

      // Filter to only return extractors (not verifiers)
      // This ensures V3 conversion uses only extractor prompts
      setExtractorPrompts(data.extractors || [])
    } catch {
      setError('Failed to load prompts')
      setExtractorPrompts([])
    } finally {
      setIsLoading(false)
    }
  }, [lessonId])

  // Initial fetch on mount or lessonId change
  useEffect(() => {
    if (lessonId) {
      fetchPrompts()
    }
  }, [lessonId, fetchPrompts])

  const retry = useCallback(() => {
    fetchPrompts()
  }, [fetchPrompts])

  return {
    extractorPrompts,
    isLoading,
    error,
    retry,
  }
}
