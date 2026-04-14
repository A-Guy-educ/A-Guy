'use client'

import { cn } from '@/infra/utils/ui'
import { Square, Volume2, Pause, Play } from 'lucide-react'

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const

interface TTSButtonProps {
  isPlaying: boolean
  isPaused: boolean
  currentRate: number
  onToggle: () => void
  onPause: () => void
  onResume: () => void
  onSetRate: (rate: number) => void
  labelPlay: string
  labelStop: string
  labelPause: string
  labelResume: string
  labelSpeed: string
}

export function TTSButton({
  isPlaying,
  isPaused,
  currentRate,
  onToggle,
  onPause,
  onResume,
  onSetRate,
  labelPlay,
  labelStop,
  labelPause,
  labelResume,
  labelSpeed,
}: TTSButtonProps) {
  return (
    <div className="mt-2 ms-auto flex flex-col items-end gap-1">
      {/* Speed selector pills */}
      {isPlaying && (
        <div className="flex items-center gap-1 animate-in fade-in slide-in-from-top-2 duration-normal">
          <span className="text-[10px] text-muted-foreground pe-1 rtl:pe-0 rtl:ps-1">{labelSpeed}</span>
          <div className="flex items-center rounded-full bg-muted/80 p-px shadow-elevation-1">
            {SPEED_PRESETS.map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSetRate(speed)
                }}
                className={cn(
                  'w-6 h-5 rounded-full text-[10px] font-medium transition-all duration-normal',
                  currentRate === speed
                    ? 'bg-primary text-primary-foreground shadow-elevation-1'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
                aria-label={`${labelSpeed} ${speed}x`}
                aria-pressed={currentRate === speed}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main TTS button with pause/play toggle */}
      <div className="flex items-center gap-1">
        {/* Pause/Resume button */}
        {isPlaying && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (isPaused) {
                onResume()
              } else {
                onPause()
              }
            }}
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-full shadow-elevation-1 transition-colors transition-all duration-normal',
              isPaused
                ? 'bg-warning/15 text-warning hover:bg-warning/25'
                : 'bg-primary/15 text-primary hover:bg-primary/25',
            )}
            aria-label={isPaused ? labelResume : labelPause}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Stop button */}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-full shadow-elevation-1 transition-colors transition-all duration-normal',
            isPlaying
              ? 'bg-primary/15 text-primary hover:bg-primary/25'
              : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80',
          )}
          aria-label={isPlaying ? labelStop : labelPlay}
        >
          {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}