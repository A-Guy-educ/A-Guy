'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { stripMarkdown, detectLanguage, hasNativeVoiceForLocale } from '@/infra/utils/speechHelpers'
import type { SupportedLocale } from '@/infra/utils/latexToSpeech'

const LOCALE_TO_LANG: Record<string, string> = {
  he: 'he-IL',
  en: 'en-US',
}

/** Prime the voice list so getVoices() is populated when we need it. */
function primeSpeechVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.getVoices()
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices()
    }
  }
}

function pickVoiceForLocale(locale: string): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined
  const voices = window.speechSynthesis.getVoices()
  const langPrefix = locale === 'he' ? ['he', 'iw'] : [locale]
  const matching = voices.filter((v) => langPrefix.some((p) => v.lang.startsWith(p)))
  if (matching.length === 0) return undefined
  if (locale === 'he') {
    return (
      matching.find((v) => v.name.includes('Natural') || v.name.includes('Online')) ??
      matching.find((v) => v.name.includes('Hila') || v.name.includes('Carmit')) ??
      matching.find((v) => v.name.includes('Google') || v.name.includes('Premium')) ??
      matching[0]
    )
  }
  return (
    matching.find((v) => v.name.includes('Natural') || v.name.includes('Google')) ?? matching[0]
  )
}

interface UseTTSReturn {
  speak: (messageId: string, text: string, locale?: SupportedLocale) => void
  stop: () => void
  pause: () => void
  resume: () => void
  setRate: (rate: number) => void
  playingMessageId: string | null
  isPaused: boolean
  currentRate: number
}

export function useTTS(): UseTTSReturn {
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [currentRate, setCurrentRateState] = useState(1.0)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isLoadingRef = useRef(false)
  // Track browser TTS position for mid-playback rate changes
  const charIndexRef = useRef(0)
  const fullTextRef = useRef('')
  const localeRef = useRef<SupportedLocale>('en')
  const isRateChangeRef = useRef(false)

  // Prime voice list on mount (Chrome loads voices async)
  useEffect(() => {
    primeSpeechVoices()
  }, [])

  const stop = useCallback(() => {
    // Stop cloud audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    // Stop browser TTS
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    utteranceRef.current = null
    charIndexRef.current = 0
    fullTextRef.current = ''
    setPlayingMessageId(null)
    setIsPaused(false)
  }, [])

  const pause = useCallback(() => {
    // Cloud audio pause
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      setIsPaused(true)
      return
    }
    // Browser TTS pause
    if (
      typeof window !== 'undefined' &&
      window.speechSynthesis &&
      window.speechSynthesis.speaking
    ) {
      window.speechSynthesis.pause()
      setIsPaused(true)
    }
  }, [])

  const resume = useCallback(() => {
    // Cloud audio resume
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play()
      setIsPaused(false)
      return
    }
    // Browser TTS resume
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
      setIsPaused(false)
    }
  }, [])

  const setRate = useCallback(
    (rate: number) => {
      setCurrentRateState(rate)
      // Cloud audio supports live rate changes
      if (audioRef.current) {
        audioRef.current.playbackRate = rate
        return
      }
      // Browser TTS: cancel and restart from current position with new rate
      if (
        utteranceRef.current &&
        typeof window !== 'undefined' &&
        window.speechSynthesis?.speaking
      ) {
        const remainingText = fullTextRef.current.slice(charIndexRef.current)
        if (!remainingText) return

        isRateChangeRef.current = true
        window.speechSynthesis.cancel()
        isRateChangeRef.current = false
        utteranceRef.current = null

        const utterance = new SpeechSynthesisUtterance(remainingText)
        const locale = localeRef.current
        utterance.lang = LOCALE_TO_LANG[locale] ?? 'en-US'
        const voice = pickVoiceForLocale(locale)
        if (voice) utterance.voice = voice
        utterance.rate = 0.85 * rate
        utterance.pitch = 0.95

        const baseOffset = charIndexRef.current
        utterance.onboundary = (event: SpeechSynthesisEvent) => {
          charIndexRef.current = baseOffset + event.charIndex
        }
        utterance.onend = () => {
          if (isRateChangeRef.current) return
          setPlayingMessageId(null)
          utteranceRef.current = null
          setIsPaused(false)
        }
        utterance.onerror = () => {
          if (isRateChangeRef.current) return
          setPlayingMessageId(null)
          utteranceRef.current = null
          setIsPaused(false)
        }
        utteranceRef.current = utterance
        window.speechSynthesis.speak(utterance)
      }
    },
    [playingMessageId],
  )

  const speak = useCallback(
    (messageId: string, text: string, locale?: SupportedLocale) => {
      if (typeof window === 'undefined') return
      if (playingMessageId === messageId && !isPaused) {
        stop()
        return
      }
      if (playingMessageId === messageId && isPaused) {
        resume()
        return
      }
      stop()

      // Detect language if not provided
      const detectedLocale: SupportedLocale =
        locale ?? (detectLanguage(text) === 'he-IL' ? 'he' : 'en')
      const cleanText = stripMarkdown(text, detectedLocale)
      if (!cleanText) return

      // Check if browser has a native voice for this locale
      if (!hasNativeVoiceForLocale(detectedLocale)) {
        // Cloud TTS fallback
        if (isLoadingRef.current) return
        isLoadingRef.current = true
        setPlayingMessageId(messageId)

        fetch('/api/tts/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText, locale: detectedLocale }),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`TTS API error: ${res.status}`)
            return res.json()
          })
          .then(({ audioContent }) => {
            const audio = new Audio(`data:audio/mp3;base64,${audioContent}`)
            audioRef.current = audio
            audio.playbackRate = currentRate
            audio.onended = () => {
              setPlayingMessageId(null)
              audioRef.current = null
              setIsPaused(false)
            }
            audio.onerror = () => {
              setPlayingMessageId(null)
              audioRef.current = null
              setIsPaused(false)
            }
            audio.play()
          })
          .catch(() => {
            setPlayingMessageId(null)
            setIsPaused(false)
          })
          .finally(() => {
            isLoadingRef.current = false
          })

        return
      }

      // Browser TTS path
      if (!window.speechSynthesis) return
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel()
      }

      // Store for mid-playback rate changes
      fullTextRef.current = cleanText
      localeRef.current = detectedLocale
      charIndexRef.current = 0

      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = LOCALE_TO_LANG[detectedLocale] ?? 'en-US'
      const voice = pickVoiceForLocale(detectedLocale)
      if (voice) utterance.voice = voice
      utterance.rate = 0.85 * currentRate
      utterance.pitch = 0.95
      utterance.onboundary = (event: SpeechSynthesisEvent) => {
        charIndexRef.current = event.charIndex
      }
      utterance.onend = () => {
        if (isRateChangeRef.current) return
        setPlayingMessageId(null)
        utteranceRef.current = null
        setIsPaused(false)
      }
      utterance.onerror = () => {
        if (isRateChangeRef.current) return
        setPlayingMessageId(null)
        utteranceRef.current = null
        setIsPaused(false)
      }
      utteranceRef.current = utterance
      setPlayingMessageId(messageId)
      window.speechSynthesis.speak(utterance)
    },
    [playingMessageId, stop, isPaused, resume, currentRate],
  )

  useEffect(
    () => () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    },
    [],
  )

  return { speak, stop, pause, resume, setRate, playingMessageId, isPaused, currentRate }
}
