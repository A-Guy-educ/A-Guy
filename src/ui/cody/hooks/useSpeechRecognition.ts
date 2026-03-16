'use client'
/**
 * @fileType hook
 * @domain cody
 * @pattern browser-speech-api
 * @ai-summary React hook wrapping Web Speech Recognition API for speech-to-text
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseSpeechRecognitionOptions {
  lang?: string
  onResult?: (transcript: string) => void
  onError?: (error: string) => void
}
export interface UseSpeechRecognitionReturn {
  start: () => void
  stop: () => void
  isListening: boolean
  transcript: string
  finalTranscript: string
  error: string | null
  isSupported: boolean
}

function getCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const { lang = 'en-US', onResult, onError } = options
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognition | null>(null)
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const isSupported = typeof window !== 'undefined' && getCtor() !== null

  const stop = useCallback(() => {
    const r = recRef.current
    if (r) {
      r.onend = null
      r.onresult = null
      r.onerror = null
      try {
        r.stop()
      } catch {
        /* already stopped */
      }
      recRef.current = null
    }
    setIsListening(false)
  }, [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) {
      const msg = 'Speech recognition is not supported in this browser'
      setError(msg)
      onErrorRef.current?.(msg)
      return
    }
    stop()
    setError(null)
    setTranscript('')

    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onstart = () => setIsListening(true)
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = '',
        final = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        if (r.isFinal) final += r[0].transcript
        else interim += r[0].transcript
      }
      if (final) {
        setFinalTranscript(final)
        setTranscript(final)
        onResultRef.current?.(final)
      } else setTranscript(interim)
    }
    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') {
        setIsListening(false)
        return
      }
      const msg =
        ev.error === 'not-allowed'
          ? 'Microphone access was denied. Please allow microphone access in your browser settings.'
          : `Speech recognition error: ${ev.error}`
      setError(msg)
      setIsListening(false)
      onErrorRef.current?.(msg)
    }
    rec.onend = () => {
      setIsListening(false)
      recRef.current = null
    }

    recRef.current = rec
    try {
      rec.start()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start speech recognition'
      setError(msg)
      setIsListening(false)
      onErrorRef.current?.(msg)
    }
  }, [lang, stop])

  useEffect(
    () => () => {
      const r = recRef.current
      if (r) {
        r.onend = null
        r.onresult = null
        r.onerror = null
        try {
          r.stop()
        } catch {
          /* */
        }
        recRef.current = null
      }
    },
    [],
  )

  return { start, stop, isListening, transcript, finalTranscript, error, isSupported }
}
