'use client'

import { useCallback, useState } from 'react'
import type { GuidedExplanationV2 } from '@/infra/contracts/guided-explanation/v2'

type GenerationStatus = 'idle' | 'generating' | 'done' | 'error'

interface UseGenerateLessonResult {
  lesson: GuidedExplanationV2 | null
  status: GenerationStatus
  error: string | null
  generate: (mediaId: string, locale: 'he' | 'en') => Promise<void>
}

/**
 * Hook to trigger interactive lesson generation from an uploaded image.
 * Returns a validated GuidedExplanationV2 payload.
 */
export function useGenerateLesson(): UseGenerateLessonResult {
  const [lesson, setLesson] = useState<GuidedExplanationV2 | null>(null)
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (mediaId: string, locale: 'he' | 'en') => {
    setStatus('generating')
    setError(null)

    try {
      const response = await fetch('/api/agent/generate-interactive-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mediaId, locale }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setStatus('error')
        setError(result.error || 'Generation failed')
        return
      }

      setLesson(result.data)
      setStatus('done')
    } catch {
      setStatus('error')
      setError('Network error — please try again')
    }
  }, [])

  return { lesson, status, error, generate }
}
