'use client'

import React, { useState } from 'react'
import { Lightbulb, BookOpen, FileText } from 'lucide-react'
import type { InlineRichText, RichTextBlock } from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'

interface HintSolutionPanelProps {
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
  t: (key: string) => string
}

function hasContent(field?: InlineRichText): boolean {
  return !!field && field.value.trim() !== ''
}

export function HintSolutionPanel({ hint, solution, fullSolution, t }: HintSolutionPanelProps) {
  const [showHint, setShowHint] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [showFullSolution, setShowFullSolution] = useState(false)

  const hasHint = hasContent(hint)
  const hasSolution = hasContent(solution)
  const hasFullSolution = hasContent(fullSolution)

  if (!hasHint && !hasSolution && !hasFullSolution) return null

  const renderField = (
    field: InlineRichText,
    id: string,
    show: boolean,
    setShow: (v: boolean) => void,
    showKey: string,
    hideKey: string,
    Icon: typeof Lightbulb,
    canShow: boolean,
  ) => {
    if (!canShow) return null
    return (
      <div className="mt-3">
        <button
          onClick={() => setShow(!show)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
        >
          <Icon className="w-4 h-4" />
          {show ? t(hideKey) : t(showKey)}
        </button>
        {show && (
          <div className="mt-2 p-3 rounded-md bg-muted/50 border border-border text-sm">
            <RichTextRenderer
              block={
                {
                  ...field,
                  id,
                  mediaIds: field.mediaIds || [],
                } as RichTextBlock
              }
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {renderField(
        hint!,
        'hint',
        showHint,
        setShowHint,
        'showHint',
        'hideHint',
        Lightbulb,
        hasHint,
      )}
      {renderField(
        solution!,
        'solution',
        showSolution,
        setShowSolution,
        'showSolution',
        'hideSolution',
        BookOpen,
        hasSolution && (showHint || !hasHint),
      )}
      {renderField(
        fullSolution!,
        'fullSolution',
        showFullSolution,
        setShowFullSolution,
        'showFullSolution',
        'hideFullSolution',
        FileText,
        hasFullSolution && (showSolution || !hasSolution),
      )}
    </div>
  )
}
