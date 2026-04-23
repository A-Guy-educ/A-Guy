'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  stripMarkdown,
  detectLanguage,
  hasNativeVoiceForLocale,
  pickVoiceForLocale,
} from '@/infra/utils/speechHelpers'
import type { SupportedLocale } from '@/infra/utils/latexToSpeech'

const LOCALE_TO_LANG: Record<string, string> = {
  he: 'he-IL',
  en: 'en-US',
}

/** Max chars per utterance to avoid Chrome's silent-cutoff bug. */
const MAX_CHUNK_LENGTH = 180

/**
 * Split text into sentence-sized chunks for browser TTS.
 * Chrome silently stops speaking long utterances (~200-300 chars),
 * so we split at sentence boundaries to keep each chunk short.
 */
function splitIntoChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK_LENGTH) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK_LENGTH) {
      chunks.push(remaining)
      break
    }
    // Try to split at sentence boundary (. ! ?) within limit
    const slice = remaining.slice(0, MAX_CHUNK_LENGTH)
    const sentenceEnd = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('? '),
      slice.lastIndexOf('! '),
    )
    if (sentenceEnd > 40) {
      chunks.push(remaining.slice(0, sentenceEnd + 1).trim())
      remaining = remaining.slice(sentenceEnd + 1).trim()
      continue
    }
    // Fall back to comma/colon
    const clauseEnd = Math.max(
      slice.lastIndexOf(', '),
      slice.lastIndexOf(': '),
      slice.lastIndexOf('; '),
    )
    if (clauseEnd > 40) {
      chunks.push(remaining.slice(0, clauseEnd + 1).trim())
      remaining = remaining.slice(clauseEnd + 1).trim()
      continue
    }
    // Fall back to last space
    const spaceEnd = slice.lastIndexOf(' ')
    if (spaceEnd > 20) {
      chunks.push(remaining.slice(0, spaceEnd).trim())
      remaining = remaining.slice(spaceEnd).trim()
      continue
    }
    // No good break point — take the whole slice
    chunks.push(slice.trim())
    remaining = remaining.slice(MAX_CHUNK_LENGTH).trim()
  }

  return chunks.filter((c) => c.length > 0)
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
  // Chunked utterance queue for long texts
  const chunksRef = useRef<string[]>([])
  const chunkIndexRef = useRef(0)

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
    chunksRef.current = []
    chunkIndexRef.current = 0
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

  /** Speak the current chunk and advance to the next one on end. */
  const speakChunk = useCallback((locale: SupportedLocale, rate: number) => {
    if (!window.speechSynthesis) return
    const chunks = chunksRef.current
    const idx = chunkIndexRef.current
    if (idx >= chunks.length) {
      setPlayingMessageId(null)
      utteranceRef.current = null
      setIsPaused(false)
      return
    }

    const chunkText = chunks[idx]
    const utterance = new SpeechSynthesisUtterance(chunkText)
    utterance.lang = LOCALE_TO_LANG[locale] ?? 'en-US'
    const voice = pickVoiceForLocale(locale)
    if (voice) utterance.voice = voice
    utterance.rate = 0.85 * rate
    utterance.pitch = 0.95

    // Track character position within full text
    const chunkOffset = chunks.slice(0, idx).reduce((sum, c) => sum + c.length + 1, 0)
    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      charIndexRef.current = chunkOffset + event.charIndex
    }
    utterance.onend = () => {
      chunkIndexRef.current += 1
      if (chunkIndexRef.current < chunksRef.current.length) {
        speakChunk(locale, rate)
      } else {
        setPlayingMessageId(null)
        utteranceRef.current = null
        setIsPaused(false)
      }
    }
    utterance.onerror = () => {
      setPlayingMessageId(null)
      utteranceRef.current = null
      setIsPaused(false)
    }
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [])

  const setRate = useCallback(
    (rate: number) => {
      setCurrentRateState(rate)
      // Cloud audio supports live rate changes
      if (audioRef.current) {
        audioRef.current.playbackRate = rate
        return
      }
      // Browser TTS: cancel current chunk and restart from current position with new rate
      if (
        utteranceRef.current &&
        typeof window !== 'undefined' &&
        window.speechSynthesis?.speaking
      ) {
        // Detach old utterance callbacks before cancelling so they don't clear state
        if (utteranceRef.current) {
          utteranceRef.current.onend = null
          utteranceRef.current.onerror = null
          utteranceRef.current.onboundary = null
        }
        window.speechSynthesis.cancel()
        utteranceRef.current = null

        // Re-chunk remaining text from current position at the new rate
        const remainingText = fullTextRef.current.slice(charIndexRef.current)
        if (!remainingText) return
        chunksRef.current = splitIntoChunks(remainingText)
        chunkIndexRef.current = 0

        speakChunk(localeRef.current, rate)
      }
    },
    [speakChunk],
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

      // Browser TTS path — split into chunks to avoid Chrome's silent-cutoff bug
      if (!window.speechSynthesis) return
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel()
      }

      // Store for mid-playback rate changes
      fullTextRef.current = cleanText
      localeRef.current = detectedLocale
      charIndexRef.current = 0

      const chunks = splitIntoChunks(cleanText)
      chunksRef.current = chunks
      chunkIndexRef.current = 0

      setPlayingMessageId(messageId)
      speakChunk(detectedLocale, currentRate)
    },
    [playingMessageId, stop, isPaused, resume, currentRate, speakChunk],
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
