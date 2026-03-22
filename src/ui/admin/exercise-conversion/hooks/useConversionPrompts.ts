'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Prompt option from the API
 */
export interface PromptOption {
  id: string
  title: string
  promptKey: string
  type: string
  usage: string
}

/**
 * Result from the useConversionPrompts hook
 */
export interface UseConversionPromptsResult {
  extractorPrompts: PromptOption[]
  verifierPrompts: PromptOption[]
  isLoading: boolean
  error: string | null
  retry: () => void
}

/**
 * Custom hook to fetch conversion prompts (extractors and verifiers).
 *
 * Fetches prompts from /api/prompts/for-conversion and returns both
 * extractor and verifier prompt lists.
 *
 * @param lessonId - The ID of the lesson to fetch prompts for (empty string skips fetch)
 * @returns Object containing prompt lists, loading state, error state, and retry function
 */
export function useConversionPrompts(lessonId: string): UseConversionPromptsResult {
  const [extractorPrompts, setExtractorPrompts] = useState<PromptOption[]>([])
  const [verifierPrompts, setVerifierPrompts] = useState<PromptOption[]>([])
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

      setExtractorPrompts(data.extractors || [])
      setVerifierPrompts(data.verifiers || [])
    } catch {
      setError('Failed to load prompts')
      setExtractorPrompts([])
      setVerifierPrompts([])
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
    verifierPrompts,
    isLoading,
    error,
    retry,
  }
}
