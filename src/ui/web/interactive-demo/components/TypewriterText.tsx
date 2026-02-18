'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { cn } from '@/infra/utils/ui'

interface TypewriterTextProps {
  text: string
  enabled: boolean
  onComplete?: () => void
  onTypingStateChange?: (isTyping: boolean, finishTyping: () => void) => void
  className?: string
  children?: React.ReactNode
}

export interface TypewriterTextHandle {
  finishTyping: () => boolean
}

export const TypewriterText = forwardRef<TypewriterTextHandle, TypewriterTextProps>(
  ({ text, enabled, onComplete, onTypingStateChange, className, children }, ref) => {
    const [displayedText, setDisplayedText] = useState(enabled ? '' : text)
    const [isTyping, setIsTyping] = useState(enabled)
    const indexRef = useRef(0)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const finishTyping = useCallback(() => {
      if (!isTyping) return false

      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      setDisplayedText(text)
      setIsTyping(false)
      onComplete?.()
      onTypingStateChange?.(false, () => {})
      return true
    }, [isTyping, text, onComplete, onTypingStateChange])

    useImperativeHandle(ref, () => ({
      finishTyping,
    }))

    useEffect(() => {
      if (!enabled) {
        setDisplayedText(text)
        setIsTyping(false)
        return
      }

      indexRef.current = 0
      setDisplayedText('')
      setIsTyping(true)
      onTypingStateChange?.(true, finishTyping)

      const typeNextChar = () => {
        if (indexRef.current < text.length) {
          setDisplayedText(text.slice(0, indexRef.current + 1))
          indexRef.current++
          timerRef.current = setTimeout(typeNextChar, 16) // ~60fps
        } else {
          setIsTyping(false)
          onComplete?.()
          onTypingStateChange?.(false, () => {})
        }
      }

      typeNextChar()

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
        }
      }
    }, [enabled, text, onComplete, onTypingStateChange, finishTyping])

    if (!enabled || !isTyping) {
      return <div className={className}>{children}</div>
    }

    return (
      <div className={cn(className, 'demo-typing-caret')}>
        {displayedText}
      </div>
    )
  },
)

TypewriterText.displayName = 'TypewriterText'
