'use client'

import { useState, useCallback } from 'react'

export type TranslationStatus = 'idle' | 'loading' | 'success' | 'error'

interface TranslationResult {
  id?: string
  title?: string
  exercises?: Array<{ sourceId: string; newId: string; title: string }>
  chapters?: unknown[]
}

export function useTranslation() {
  const [status, setStatus] = useState<TranslationStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TranslationResult | null>(null)

  const translate = useCallback(async (body: Record<string, unknown>) => {
    setStatus('loading')
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/translation/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!data.success) {
        setStatus('error')
        setError(data.error || 'Translation failed')
        return
      }

      setStatus('success')
      setResult(data.data)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Network error')
    }
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setResult(null)
  }, [])

  return { status, error, result, translate, reset }
}
