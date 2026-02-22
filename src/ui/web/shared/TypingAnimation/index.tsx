'use client'

import { useState, useEffect } from 'react'

import { cn } from '@/infra/utils/ui'

interface TypingAnimationProps {
  text: string
  speed?: number // ms per character (default: 50)
  onComplete?: () => void
  className?: string
}

export function TypingAnimation({ text, speed = 50, onComplete, className }: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (displayedText.length < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1))
      }, speed)
      return () => clearTimeout(timeout)
    } else {
      setIsComplete(true)
      onComplete?.()
    }
  }, [displayedText, text, speed, onComplete])

  return (
    <div className={cn('font-mono', className)}>
      {displayedText}
      {!isComplete && <span className="inline-block w-2 h-5 bg-foreground ml-1 animate-pulse" />}
    </div>
  )
}
