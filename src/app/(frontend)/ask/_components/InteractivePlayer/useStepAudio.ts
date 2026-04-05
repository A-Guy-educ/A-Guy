'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { InteractiveLessonStep } from '@/infra/llm/services/interactive-lesson/interactive-lesson-types'

interface UseStepAudioOptions {
  steps: InteractiveLessonStep[]
  currentStepIndex: number
  isPlaying: boolean
  playbackSpeed: number
}

/**
 * Hook to manage audio playback synced with the interactive player.
 * Plays the current step's TTS audio, pausing/resuming with the player.
 * Uses Web Audio API playbackRate for speed control.
 */
export function useStepAudio({
  steps,
  currentStepIndex,
  isPlaying,
  playbackSpeed,
}: UseStepAudioOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentUrlRef = useRef<string | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio(audioRef, currentUrlRef)
    }
  }, [])

  // When step changes, load new audio
  useEffect(() => {
    cleanupAudio(audioRef, currentUrlRef)

    const step = steps[currentStepIndex]
    if (!step?.audioBase64) return

    const blob = base64ToBlob(step.audioBase64, 'audio/mpeg')
    const url = URL.createObjectURL(blob)
    currentUrlRef.current = url

    const audio = new Audio(url)
    audio.playbackRate = playbackSpeed
    audioRef.current = audio

    if (isPlaying) {
      audio.play().catch(() => {
        // Browser may block autoplay — graceful degradation
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isPlaying/playbackSpeed handled by their own effects
  }, [currentStepIndex, steps])

  // Sync play/pause state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Sync playback speed
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = playbackSpeed
  }, [playbackSpeed])

  const stopAudio = useCallback(() => {
    cleanupAudio(audioRef, currentUrlRef)
  }, [])

  return { stopAudio }
}

function cleanupAudio(
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  urlRef: React.MutableRefObject<string | null>,
) {
  if (audioRef.current) {
    audioRef.current.pause()
    audioRef.current = null
  }
  if (urlRef.current) {
    URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64)
  const byteArray = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i)
  }
  return new Blob([byteArray], { type: mimeType })
}
