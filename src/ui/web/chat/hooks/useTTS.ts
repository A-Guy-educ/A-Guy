'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Strip markdown formatting, LaTeX, and code blocks from text
 * so the TTS engine reads clean plaintext.
 */
function stripMarkdown(text: string): string {
  return (
    text
      // Remove code blocks (```...```)
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code (`...`)
      .replace(/`[^`]*`/g, '')
      // Remove LaTeX block math ($$...$$)
      .replace(/\$\$[\s\S]*?\$\$/g, '')
      // Remove LaTeX inline math ($...$)
      .replace(/\$[^$]*\$/g, '')
      // Remove LaTeX commands (\frac, \sqrt, etc.)
      .replace(/\\[a-zA-Z]+(\{[^}]*\})*/g, '')
      // Remove markdown headings (# ## ### etc.)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic (**text**, *text*, __text__, _text_)
      .replace(/(\*{1,2}|_{1,2})(.*?)\1/g, '$2')
      // Remove links [text](url) -> text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Remove images ![alt](url)
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
      // Remove horizontal rules
      .replace(/^---+$/gm, '')
      // Remove blockquote markers
      .replace(/^>\s+/gm, '')
      // Remove list markers (-, *, 1.)
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Collapse multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/**
 * Detect if text is primarily Hebrew based on character frequency.
 */
function detectLanguage(text: string): 'he-IL' | 'en-US' {
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length
  return hebrewChars > latinChars ? 'he-IL' : 'en-US'
}

interface UseTTSReturn {
  /** Start speaking a message. Stops any currently playing message first. */
  speak: (messageId: string, text: string) => void
  /** Stop any currently playing speech. */
  stop: () => void
  /** The ID of the message currently being read, or null. */
  playingMessageId: string | null
}

export function useTTS(): UseTTSReturn {
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    utteranceRef.current = null
    setPlayingMessageId(null)
  }, [])

  const speak = useCallback(
    (messageId: string, text: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return

      // If already playing this message, stop it (toggle behavior)
      if (playingMessageId === messageId) {
        stop()
        return
      }

      // Stop any current speech
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  return { speak, stop, playingMessageId }
}
