'use client'

import { cn } from '@/infra/utils/ui'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'

interface BlockRevealProps {
  children: React.ReactNode
  typewriterEnabled: boolean
  delay?: number
  onRevealComplete?: () => void
  onTypingStateChange?: (isTyping: boolean, finishTyping: () => void) => void
}

export interface BlockRevealHandle {
  finishTyping: () => boolean
}

export const BlockReveal = forwardRef<BlockRevealHandle, BlockRevealProps>(
  ({ children, typewriterEnabled, delay = 0, onRevealComplete, onTypingStateChange }, ref) => {
    const [isTyping, setIsTyping] = useState(false)
    const [isComplete, setIsComplete] = useState(!typewriterEnabled)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const finishTyping = useCallback(() => {
      if (!isTyping) return false

      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      setIsTyping(false)
      setIsComplete(true)
      onRevealComplete?.()
      onTypingStateChange?.(false, () => {})
      return true
    }, [isTyping, onRevealComplete, onTypingStateChange])

    useImperativeHandle(ref, () => ({
      finishTyping,
    }))

    useEffect(() => {
      if (!typewriterEnabled) {
        setIsComplete(true)
        return
      }

      setIsTyping(true)
      setIsComplete(false)

      const startTimer = setTimeout(() => {
        onTypingStateChange?.(true, finishTyping)

        // Simulate typing duration (1 second)
        timerRef.current = setTimeout(() => {
          setIsTyping(false)
          setIsComplete(true)
          onRevealComplete?.()
          onTypingStateChange?.(false, () => {})
        }, 1000)
      }, delay)

      return () => {
        clearTimeout(startTimer)
        if (timerRef.current) {
          clearTimeout(timerRef.current)
        }
      }
    }, [typewriterEnabled, delay, onRevealComplete, onTypingStateChange, finishTyping])

    // If typing is complete or disabled, render children directly
    if (isComplete) {
      return (
        <div className={cn('transition-all duration-500 ease-out opacity-100 translate-y-0')}>
          {children}
        </div>
      )
    }

    // While typing, clip children with caret animation
    return (
      <div
        className={cn(
          'transition-all duration-500 ease-out opacity-100 translate-y-0',
          isTyping && 'demo-typing-caret',
        )}
      >
        {children}
      </div>
    )
  },
)

BlockReveal.displayName = 'BlockReveal'
