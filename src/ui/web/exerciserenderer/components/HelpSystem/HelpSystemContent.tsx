/**
 * Help System Content Panel
 *
 * Accordion panel that shows hint content inline.
 * Uses MathMarkdown for rich text rendering (supports KaTeX math + media).
 */

'use client'

import React from 'react'
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
    gradientClass: 'from-amber-50/80 to-white border-amber-100/60',
    iconClass: 'text-amber-500',
  },
  guiding: {
    icon: HelpCircle,
    gradientClass: 'from-purple-50/80 to-white border-purple-100/60',
    iconClass: 'text-purple-500',
  },
  solution: {
    icon: CheckCircle2,
    gradientClass: 'from-blue-50/80 to-white border-blue-100/60',
    iconClass: 'text-blue-500',
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
      className={`p-4 rounded-2xl bg-gradient-to-br ${gradientClass} border shadow-sm animate-in slide-in-from-top-2 duration-300`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconClass}`} />
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
        <MathMarkdown content={processed} className="text-sm leading-relaxed text-foreground" />
      </div>
    </div>
  )
}
