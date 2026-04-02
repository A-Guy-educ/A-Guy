/**
 * Help System Content Panel
 *
 * Accordion panel that shows hint content inline.
 * Uses MathMarkdown for rich text rendering (supports KaTeX math + media).
 */

'use client'

import React from 'react'
import { motion } from 'framer-motion'
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
    pillClass: 'bg-warning/10 text-warning',
  },
  guiding: {
    icon: HelpCircle,
    gradientClass: 'bg-accent/5 border-accent/20',
    iconClass: 'text-accent',
    pillClass: 'bg-accent/10 text-accent',
  },
  solution: {
    icon: CheckCircle2,
    gradientClass: 'bg-primary/5 border-primary/20',
    iconClass: 'text-primary',
    pillClass: 'bg-primary/10 text-primary',
  },
} as const

const EASE_OUT = [0.25, 0.46, 0.45, 0.94] as const

export function HelpSystemContent({
  type,
  content,
  hintLabel,
  guidingLabel,
  solutionLabel,
}: HelpSystemContentProps) {
  const { icon: Icon, gradientClass, iconClass, pillClass } = CONFIG[type]
  const label = type === 'hint' ? hintLabel : type === 'guiding' ? guidingLabel : solutionLabel
  const processed = preprocessNewlines(content)

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className="overflow-hidden"
    >
      <div className={cn('p-card-padding-sm rounded-2xl border shadow-elevation-1', gradientClass)}>
        <div className="flex items-center gap-content-gap-xs mb-3 pb-2 border-b border-current/10">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-body-xs font-medium',
              pillClass,
            )}
          >
            <Icon className={cn('w-3.5 h-3.5', iconClass)} />
            {label}
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.25 }}
          className="prose prose-sm prose-slate dark:prose-invert max-w-none"
        >
          <MathMarkdown
            content={processed}
            className="text-body-sm leading-relaxed text-foreground"
          />
        </motion.div>
      </div>
    </motion.div>
  )
}
