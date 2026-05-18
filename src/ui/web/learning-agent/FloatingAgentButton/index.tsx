'use client'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { Sparkles } from 'lucide-react'

interface FloatingAgentButtonProps {
  onClick: () => void
}

/**
 * Floating learning agent button
 * Appears in the bottom-right corner of the screen
 * Opens the learning agent chat window on click
 */
export function FloatingAgentButton({ onClick }: FloatingAgentButtonProps) {
  const { user, isLoading } = useCurrentUser()

  if (isLoading || !user) {
    return null
  }

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-elevation-3 hover:scale-110 hover:bg-primary/90 transition-all duration-normal flex items-center justify-center"
      aria-label="Open Learning Assistant"
    >
      <Sparkles className="w-6 h-6" />
    </button>
  )
}
