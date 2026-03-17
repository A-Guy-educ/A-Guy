'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { stripMarkdown, detectLanguage } from '@/infra/utils/speechHelpers'

interface UseTTSReturn {
  speak: (messageId: string, text: string) => void
  stop: () => void
  playingMessageId: string | null
}

export function useTTS(): UseTTSReturn {
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    utteranceRef.current = null
    setPlayingMessageId(null)
  }, [])

  const speak = useCallback(
    (messageId: string, text: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return
      if (playingMessageId === messageId) {
        stop()
        return
      }
      stop()
      const cleanText = stripMarkdown(text)
      if (!cleanText) return
      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = detectLanguage(cleanText)
      utterance.onend = () => {
        setPlayingMessageId(null)
        utteranceRef.current = null
      }
      utterance.onerror = () => {
        setPlayingMessageId(null)
        utteranceRef.current = null
      }
      utteranceRef.current = utterance
      setPlayingMessageId(messageId)
      window.speechSynthesis.speak(utterance)
    },
    [playingMessageId, stop],
  )

  useEffect(
    () => () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    },
    [],
  )

  return { speak, stop, playingMessageId }
}
