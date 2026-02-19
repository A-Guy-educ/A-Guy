'use client'

import { cn } from '@/infra/utils/ui'
import { Square, Volume2 } from 'lucide-react'

interface TTSButtonProps {
  isPlaying: boolean
  onToggle: () => void
  labelPlay: string
  labelStop: string
}

export function TTSButton({ isPlaying, onToggle, labelPlay, labelStop }: TTSButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'mt-2 ms-auto flex items-center justify-center',
        'w-7 h-7 rounded-full shadow-sm transition-colors',
        isPlaying
          ? 'bg-primary/15 text-primary hover:bg-primary/25'
          : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80',
      )}
      aria-label={isPlaying ? labelStop : labelPlay}
    >
      {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
    </button>
  )
}
