/**
 * Help System
 *
 * Composes HelpSystemButtons + HelpSystemContent for a single question.
 * Renders below the question content, before the check button.
 */

'use client'

import React from 'react'
import type { HelpUsageState, QuestionBlock } from '../../types'
import { HelpSystemButtons } from './HelpSystemButtons'
import { HelpSystemContent } from './HelpSystemContent'

interface HelpSystemProps {
  question: QuestionBlock
  helpUsage: HelpUsageState
  activeHelp: 'hint' | 'guiding' | 'solution' | null
  onHintClick: () => void
  onGuidingClick: () => void
  onSolutionClick: () => void
  hintLabel: string
  guidingLabel: string
  solutionLabel: string
}

export function HelpSystem({
  question,
  helpUsage,
  activeHelp,
  onHintClick,
  onGuidingClick,
  onSolutionClick,
  hintLabel,
  guidingLabel,
  solutionLabel,
}: HelpSystemProps) {
  const hasHint = Boolean(question.hint?.value)
  const hasGuiding = Boolean(question.solution?.value)
  const hasSolution = Boolean(question.fullSolution?.value)

  // Don't render if no help content available
  if (!hasHint && !hasGuiding && !hasSolution) return null

  // Determine which content to show inline (hint only; guiding + solution go to chat)
  const inlineContent = activeHelp === 'hint' && question.hint?.value ? question.hint.value : null

  return (
    <div className="mt-4 border-t border-gray-100/60 pt-3">
      <HelpSystemButtons
        helpUsage={helpUsage}
        activeHelp={activeHelp}
        onHintClick={onHintClick}
        onGuidingClick={onGuidingClick}
        onSolutionClick={onSolutionClick}
        hintLabel={hintLabel}
        guidingLabel={guidingLabel}
        solutionLabel={solutionLabel}
        hasHint={hasHint}
        hasGuiding={hasGuiding}
        hasSolution={hasSolution}
      />

      {inlineContent && (
        <div className="mt-3">
          <HelpSystemContent
            type="hint"
            content={inlineContent}
            hintLabel={hintLabel}
            guidingLabel={guidingLabel}
            solutionLabel={solutionLabel}
          />
        </div>
      )}
    </div>
  )
}
