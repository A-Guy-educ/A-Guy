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
    const [displayedText, setDisplayedText] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [isComplete, setIsComplete] = useState(!typewriterEnabled)
    const textRef = useRef<string>('')
    const indexRef = useRef(0)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Extract text content from children for typewriter
    const extractText = useCallback((node: React.ReactNode): string => {
      if (typeof node === 'string') return node
      if (typeof node === 'number') return String(node)
      if (Array.isArray(node)) return node.map(extractText).join('')
      if (node && typeof node === 'object' && 'props' in node) {
        return extractText((node as { props: { children?: React.ReactNode } }).props.children)
      }
      return ''
    }, [])

    const finishTyping = useCallback(() => {
      if (!isTyping) return false

      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      setDisplayedText(textRef.current)
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

      // Extract text from children
      textRef.current = extractText(children)
      indexRef.current = 0
      setDisplayedText('')
      setIsTyping(true)
      setIsComplete(false)

      const typeNextChar = () => {
        if (indexRef.current < textRef.current.length) {
          setDisplayedText(textRef.current.slice(0, indexRef.current + 1))
          indexRef.current++
          timerRef.current = setTimeout(typeNextChar, 16) // ~60fps for smooth typing
        } else {
          setIsTyping(false)
          setIsComplete(true)
          onRevealComplete?.()
          onTypingStateChange?.(false, () => {})
        }
      }

      const startTimer = setTimeout(() => {
        onTypingStateChange?.(true, finishTyping)
        typeNextChar()
      }, delay)

      return () => {
        clearTimeout(startTimer)
        if (timerRef.current) {
          clearTimeout(timerRef.current)
        }
      }
    }, [
      typewriterEnabled,
      children,
      delay,
      onRevealComplete,
      onTypingStateChange,
      extractText,
      finishTyping,
    ])

    // If typing is complete or disabled, render children directly
    if (isComplete) {
      return (
        <div className={cn('transition-all duration-500 ease-out opacity-100 translate-y-0')}>
          {children}
        </div>
      )
    }

    // While typing, show text with caret
    return (
      <div className={cn('transition-all duration-500 ease-out opacity-100 translate-y-0')}>
        <div className={cn(isTyping && 'demo-typing-caret')}>{displayedText}</div>
      </div>
    )
  },
)

BlockReveal.displayName = 'BlockReveal'
