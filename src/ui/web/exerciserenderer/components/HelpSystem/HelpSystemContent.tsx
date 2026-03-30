/**
 * Help System Content Panel
 *
 * Accordion panel that shows hint content inline.
 * Uses MathMarkdown for rich text rendering (supports KaTeX math + media).
 */

'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'
import { Lightbulb, HelpCircle, CheckCircle2 } from 'lucide-react'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { preprocessNewlines } from '@/infra/utils/textPreprocessing'

interface HelpSystemContentProps {
  type: 'hint' | 'guiding' | 'solution'
  content: string
  hintLabel: string
  guidingLabel: string
  solutionLabel: string
}

const CONFIG = {
  hint: {
    icon: Lightbulb,
    gradientClass: 'bg-warning/5 border-warning/20',
    iconClass: 'text-warning',
  },
  guiding: {
    icon: HelpCircle,
    gradientClass: 'bg-accent/5 border-accent/20',
    iconClass: 'text-accent',
  },
  solution: {
    icon: CheckCircle2,
    gradientClass: 'bg-primary/5 border-primary/20',
    iconClass: 'text-primary',
  },
} as const

export function HelpSystemContent({
  type,
  content,
  hintLabel,
  guidingLabel,
  solutionLabel,
}: HelpSystemContentProps) {
  const { icon: Icon, gradientClass, iconClass } = CONFIG[type]
  const label = type === 'hint' ? hintLabel : type === 'guiding' ? guidingLabel : solutionLabel
  const processed = preprocessNewlines(content)

  return (
    <div
      className={cn(
        'p-card-padding-sm rounded-2xl border shadow-elevation-1 animate-in slide-in-from-top-2 duration-slow',
        gradientClass,
      )}
    >
      <div className="flex items-center gap-content-gap-xs mb-2">
        <Icon className={cn('w-4 h-4', iconClass)} />
        <span className="text-body-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
        <MathMarkdown
          content={processed}
          className="text-body-sm leading-relaxed text-foreground"
        />
      </div>
    </div>
  )
}
