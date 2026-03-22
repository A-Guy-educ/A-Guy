'use client'
/**
 * @fileType hook
 * @domain cody
 * @pattern browser-speech-api
 * @ai-summary Cody-specific TTS hook with onEnd callback for conversation loop
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { stripMarkdown, detectLanguage } from '@/infra/utils/speechHelpers'

export interface UseCodyTTSOptions {
  onEnd?: () => void
  onError?: () => void
}
export interface UseCodyTTSReturn {
  speak: (text: string) => void
  cancel: () => void
  isSpeaking: boolean
  isSupported: boolean
}

export function useCodyTTS(options: UseCodyTTSOptions = {}): UseCodyTTSReturn {
  const { onEnd, onError } = options
  const [isSpeaking, setIsSpeaking] = useState(false)
  const uttRef = useRef<SpeechSynthesisUtterance | null>(null)
  const onEndRef = useRef(onEnd)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    uttRef.current = null
    setIsSpeaking(false)
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        onEndRef.current?.()
        return
      }
      cancel()
      const clean = stripMarkdown(text)
      if (!clean) {
        onEndRef.current?.()
        return
      }
      const utt = new SpeechSynthesisUtterance(clean)
      utt.lang = detectLanguage(clean)
      utt.onend = () => {
        setIsSpeaking(false)
        uttRef.current = null
        onEndRef.current?.()
      }
      utt.onerror = () => {
        setIsSpeaking(false)
        uttRef.current = null
        onErrorRef.current?.()
        onEndRef.current?.()
      }
      uttRef.current = utt
      setIsSpeaking(true)
      window.speechSynthesis.speak(utt)
    },
    [cancel],
  )

  useEffect(
    () => () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    },
    [],
  )

  return { speak, cancel, isSpeaking, isSupported }
}
