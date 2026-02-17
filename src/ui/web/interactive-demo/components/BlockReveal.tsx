'use client'

import { cn } from '@/infra/utils/ui'
import { useCallback, useEffect, useState } from 'react'

interface BlockRevealProps {
  children: React.ReactNode
  typewriterEnabled: boolean
  delay?: number
  onRevealComplete?: () => void
  onTypingStateChange?: (isTyping: boolean, finishTyping: () => void) => void
}

export function BlockReveal({
  children,
  typewriterEnabled,
  delay = 0,
  onRevealComplete,
  onTypingStateChange,
}: BlockRevealProps) {
  const [isVisible, setIsVisible] = useState(!typewriterEnabled)
  const [showSkip, setShowSkip] = useState(false)

  const handleSkip = useCallback(() => {
    setIsVisible(true)
    setShowSkip(false)
    onRevealComplete?.()
    onTypingStateChange?.(false, () => {})
  }, [onRevealComplete, onTypingStateChange])

  useEffect(() => {
    if (typewriterEnabled) {
      onTypingStateChange?.(true, handleSkip)
      const timer = setTimeout(() => {
        setIsVisible(true)
        setShowSkip(true)
        onRevealComplete?.()
        onTypingStateChange?.(false, () => {})
      }, delay + 1000) // 1 second typing effect

      return () => {
        clearTimeout(timer)
        onTypingStateChange?.(false, () => {})
      }
    }
  }, [typewriterEnabled, delay, onRevealComplete, onTypingStateChange, handleSkip])

  return (
    <div
      className={cn(
        'transition-all duration-500 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
      )}
    >
      {children}

      {typewriterEnabled && showSkip && !isVisible && (
        <button
          onClick={handleSkip}
          className="text-sm text-muted-foreground hover:text-foreground mt-2 underline"
        >
          Skip
        </button>
      )}
    </div>
  )
}
