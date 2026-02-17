'use client'

import { cn } from '@/infra/utils/ui'
import { useEffect, useState } from 'react'

interface BlockRevealProps {
  children: React.ReactNode
  typewriterEnabled: boolean
  delay?: number
  onRevealComplete?: () => void
}

export function BlockReveal({
  children,
  typewriterEnabled,
  delay = 0,
  onRevealComplete,
}: BlockRevealProps) {
  const [isVisible, setIsVisible] = useState(!typewriterEnabled)
  const [showSkip, setShowSkip] = useState(false)

  useEffect(() => {
    if (typewriterEnabled) {
      const timer = setTimeout(() => {
        setIsVisible(true)
        setShowSkip(true)
        onRevealComplete?.()
      }, delay + 1000) // 1 second typing effect

      return () => clearTimeout(timer)
    }
  }, [typewriterEnabled, delay, onRevealComplete])

  const handleSkip = () => {
    setIsVisible(true)
    setShowSkip(false)
    onRevealComplete?.()
  }

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
