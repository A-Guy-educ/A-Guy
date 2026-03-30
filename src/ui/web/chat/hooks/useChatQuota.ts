'use client'

import { useCallback, useEffect, useState } from 'react'

export interface ChatQuotaState {
  questionsUsed: number
  maxQuestions: number
  resetAt: string | null
  isLimitReached: boolean
  isLoaded: boolean
  refreshQuota: () => Promise<void>
}

export function useChatQuota(): ChatQuotaState {
  const [questionsUsed, setQuestionsUsed] = useState(0)
  const [maxQuestions, setMaxQuestions] = useState(15)
  const [resetAt, setResetAt] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  const refreshQuota = useCallback(async () => {
    try {
      const response = await fetch('/api/agent/chat-quota', { credentials: 'include' })
      if (!response.ok) return
      const data = await response.json()
      setQuestionsUsed(data.questionsUsed ?? 0)
      setMaxQuestions(data.maxQuestions ?? 15)
      setResetAt(data.resetAt ?? null)
      setIsLoaded(true)
    } catch {
      // Silently fail — quota display is non-critical
    }
  }, [])

  useEffect(() => {
    refreshQuota()
  }, [refreshQuota])

  return {
    questionsUsed,
    maxQuestions,
    resetAt,
    isLimitReached: questionsUsed >= maxQuestions,
    isLoaded,
    refreshQuota,
  }
}
