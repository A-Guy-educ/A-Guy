'use client'

import { cn } from '@/infra/utils/ui'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import type { PlaybackSpeed, PlayerActions, PlayerState } from './interactive-player-types'
import { PLAYBACK_SPEEDS } from './interactive-player-types'

interface PlayerControlsProps {
  state: PlayerState
  actions: PlayerActions
  totalSteps: number
}

export function PlayerControls({ state, actions, totalSteps }: PlayerControlsProps) {
  const globalProgress =
    totalSteps > 0 ? (state.currentStepIndex + state.stepProgress) / totalSteps : 0

  return (
    <div className="flex flex-col gap-content-gap-xs px-4 py-3 bg-muted/50 border-t border-border">
      {/* Progress bar */}
      <div
        className="relative h-2 bg-muted rounded-full cursor-pointer overflow-hidden"
        onClick={(e) => handleProgressClick(e, totalSteps, actions)}
        role="progressbar"
        aria-valuenow={Math.round(globalProgress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="absolute inset-y-0 start-0 bg-primary rounded-full transition-all duration-fast"
          style={{ width: `${globalProgress * 100}%` }}
        />
        {/* Step markers */}
        {Array.from({ length: totalSteps - 1 }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 h-full w-0.5 bg-border"
            style={{ insetInlineStart: `${((i + 1) / totalSteps) * 100}%` }}
          />
        ))}
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <ControlButton onClick={actions.prevStep} disabled={state.currentStepIndex <= 0}>
            <ChevronLeft className="w-4 h-4" />
          </ControlButton>

          <ControlButton onClick={actions.togglePlayPause} variant="primary">
            {state.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ms-0.5" />}
          </ControlButton>

          <ControlButton
            onClick={actions.nextStep}
            disabled={state.currentStepIndex >= totalSteps - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </ControlButton>
        </div>

        {/* Step indicator */}
        <span className="text-body-sm text-muted-foreground font-medium">
          {`${state.currentStepIndex + 1} / ${totalSteps}`}
        </span>

        {/* Speed selector */}
        <SpeedSelector current={state.playbackSpeed} onSelect={actions.setSpeed} />
      </div>
    </div>
  )
}

function ControlButton({
  onClick,
  disabled,
  variant,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  variant?: 'primary'
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-2 rounded-xl transition-colors duration-normal disabled:opacity-30',
        variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

function SpeedSelector({
  current,
  onSelect,
}: {
  current: PlaybackSpeed
  onSelect: (speed: PlaybackSpeed) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {PLAYBACK_SPEEDS.map((speed) => (
        <button
          key={speed}
          onClick={() => onSelect(speed)}
          className={cn(
            'px-2 py-0.5 rounded-lg text-body-xs font-medium transition-colors duration-normal',
            speed === current
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {speed}x
        </button>
      ))}
    </div>
  )
}

function handleProgressClick(
  e: React.MouseEvent<HTMLDivElement>,
  totalSteps: number,
  actions: PlayerActions,
) {
  const rect = e.currentTarget.getBoundingClientRect()
  const isRtl = getComputedStyle(e.currentTarget).direction === 'rtl'
  const clickX = isRtl ? rect.right - e.clientX : e.clientX - rect.left
  const ratio = clickX / rect.width
  const targetStep = Math.floor(ratio * totalSteps)
  actions.goToStep(Math.min(targetStep, totalSteps - 1))
}
