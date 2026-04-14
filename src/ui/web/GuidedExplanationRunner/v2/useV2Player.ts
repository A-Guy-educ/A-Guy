'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GuidedExplanationV2 } from '@/infra/contracts/guided-explanation/v2'
import { cancelSpeech, primeSpeechVoices } from '../speech'
import { resetScene, runTimeline } from './timeline'

interface UseV2PlayerArgs {
  payload: GuidedExplanationV2
  sceneRef: React.MutableRefObject<HTMLElement | null>
}

interface UseV2PlayerResult {
  isPlaying: boolean
  narrationText: string
  play: () => void
  reset: () => void
}

export function useV2Player({ payload, sceneRef }: UseV2PlayerArgs): UseV2PlayerResult {
  const [isPlaying, setIsPlaying] = useState(false)
  const [narrationText, setNarrationText] = useState(payload.narrationBox.placeholder)
  const sequenceRef = useRef(0)

  useEffect(() => {
    primeSpeechVoices()
    return () => {
      cancelSpeech()
    }
  }, [])

  const reset = useCallback(() => {
    sequenceRef.current += 1
    setIsPlaying(false)
    setNarrationText(payload.narrationBox.placeholder)
    if (sceneRef.current) resetScene(sceneRef.current)
  }, [payload.narrationBox.placeholder, sceneRef])

  const play = useCallback(() => {
    if (isPlaying) return
    const root = sceneRef.current
    if (!root) return

    sequenceRef.current += 1
    const mySequence = sequenceRef.current
    const shouldCancel = () => sequenceRef.current !== mySequence

    setIsPlaying(true)

    void (async () => {
      try {
        await runTimeline(payload.ops, {
          root,
          locale: payload.locale,
          shouldCancel,
          setNarration: setNarrationText,
        })
      } finally {
        if (!shouldCancel()) setIsPlaying(false)
      }
    })()
  }, [isPlaying, payload.ops, payload.locale, sceneRef])

  return { isPlaying, narrationText, play, reset }
}
