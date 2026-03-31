/**
 * Help System Buttons
 *
 * Three action buttons: Hint (amber), Guiding Question (purple), Solution (blue).
 * Solution is hidden until both hint and guiding have been used.
 */

'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'
import { Lightbulb, HelpCircle, CheckCircle2 } from 'lucide-react'
import type { HelpUsageState } from '../../types'

interface HelpSystemButtonsProps {
  helpUsage: HelpUsageState
  activeHelp: 'hint' | 'guiding' | 'solution' | null
  onHintClick: () => void
  onGuidingClick: () => void
  onSolutionClick: () => void
  hintLabel: string
  guidingLabel: string
  solutionLabel: string
}

export function HelpSystemButtons({
  helpUsage,
  activeHelp,
  onHintClick,
  onGuidingClick,
  onSolutionClick,
  hintLabel,
  guidingLabel,
  solutionLabel,
}: HelpSystemButtonsProps) {
  return (
    <div className="flex flex-wrap gap-content-gap-xs">
      {/* Hint Button - always visible, AI fallback when no backend content */}
      <button
        type="button"
        onClick={onHintClick}
        className={cn(
          'flex items-center gap-1.5 px-4 py-2 rounded-xl text-body-xs transition-all duration-slow border shadow-elevation-1',
          activeHelp === 'hint'
            ? 'bg-warning/10 border-warning/30 text-warning'
            : 'bg-card border-border text-muted-foreground hover:bg-muted hover:border-muted-foreground hover:shadow-elevation-3',
        )}
      >
        <Lightbulb className="w-4 h-4" />
        {hintLabel}
      </button>

      {/* Guiding Question Button - always visible, AI fallback when no backend content */}
      <button
        type="button"
        onClick={onGuidingClick}
        className={cn(
          'flex items-center gap-1.5 px-4 py-2 rounded-xl text-body-xs transition-all duration-slow border shadow-elevation-1',
          activeHelp === 'guiding'
            ? 'bg-accent/10 border-accent/30 text-accent'
            : 'bg-card border-border text-muted-foreground hover:bg-muted hover:border-muted-foreground hover:shadow-elevation-3',
        )}
      >
        <HelpCircle className="w-4 h-4" />
        {guidingLabel}
      </button>

      {/* Solution Button - hidden until unlocked */}
      {helpUsage.solutionUnlocked && (
        <button
          type="button"
          onClick={onSolutionClick}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-xl text-body-xs transition-all duration-slow border shadow-elevation-1',
            activeHelp === 'solution'
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-card border-border text-muted-foreground hover:bg-muted hover:border-muted-foreground hover:shadow-elevation-3',
          )}
        >
          <CheckCircle2 className="w-4 h-4" />
          {solutionLabel}
        </button>
      )}
    </div>
  )
}
