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
  hasHint: boolean
  hasGuiding: boolean
  hasSolution: boolean
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
  hasHint,
  hasGuiding,
  hasSolution,
}: HelpSystemButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* Hint Button */}
      {hasHint && (
        <button
          type="button"
          onClick={onHintClick}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs transition-all duration-300 border shadow-sm',
            activeHelp === 'hint'
              ? 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700 shadow-amber-100'
              : 'bg-white border-gray-200/60 text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md',
          )}
        >
          <Lightbulb className="w-4 h-4" />
          {hintLabel}
        </button>
      )}

      {/* Guiding Question Button */}
      {hasGuiding && (
        <button
          type="button"
          onClick={onGuidingClick}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs transition-all duration-300 border shadow-sm',
            activeHelp === 'guiding'
              ? 'bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200/60 text-purple-700 shadow-purple-100'
              : 'bg-white border-gray-200/60 text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md',
          )}
        >
          <HelpCircle className="w-4 h-4" />
          {guidingLabel}
        </button>
      )}

      {/* Solution Button - hidden until unlocked */}
      {hasSolution && helpUsage.solutionUnlocked && (
        <button
          type="button"
          onClick={onSolutionClick}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs transition-all duration-300 border shadow-sm',
            activeHelp === 'solution'
              ? 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700 shadow-blue-100'
              : 'bg-white border-gray-200/60 text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md',
          )}
        >
          <CheckCircle2 className="w-4 h-4" />
          {solutionLabel}
        </button>
      )}
    </div>
  )
}
