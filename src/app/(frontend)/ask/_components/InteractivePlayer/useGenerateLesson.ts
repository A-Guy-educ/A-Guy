'use client'

import { useCallback, useState } from 'react'
import type { InteractiveLesson } from '@/infra/llm/services/interactive-lesson/interactive-lesson-types'

type GenerationStatus = 'idle' | 'generating' | 'done' | 'error'

interface UseGenerateLessonResult {
  lesson: InteractiveLesson | null
  status: GenerationStatus
  error: string | null
  generate: (mediaId: string, locale: 'he' | 'en') => Promise<void>
  reset: () => void
}

/**
 * Hook to trigger interactive lesson generation from an uploaded image.
 * Calls the /api/agent/generate-interactive-lesson endpoint.
 */
export function useGenerateLesson(): UseGenerateLessonResult {
  const [lesson, setLesson] = useState<InteractiveLesson | null>(null)
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

  const reset = useCallback(() => {
    setLesson(null)
    setStatus('idle')
    setError(null)
  }, [])

  return { lesson, status, error, generate, reset }
}
