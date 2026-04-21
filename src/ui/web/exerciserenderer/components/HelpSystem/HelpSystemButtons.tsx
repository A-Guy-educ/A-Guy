/**
 * Help System Buttons
 *
 * Three action buttons: Hint (amber), Guiding Question (purple), Solution (blue).
 * Solution is hidden until both hint and guiding have been used.
 */

'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
    <div className="flex flex-wrap gap-content-gap-xs.5">
      {/* Hint Button — always amber colored */}
      <motion.button
        type="button"
        onClick={onHintClick}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          'flex items-center gap-content-gap-xs px-4 py-2 rounded-full text-body-xs font-medium transition-colors duration-normal border shadow-elevation-1',
          activeHelp === 'hint'
            ? 'bg-warning/15 border-warning/40 text-warning shadow-[inset_0_0_8px_hsl(var(--warning)/0.15)]'
            : 'bg-warning/10 border-warning/30 text-warning/80 hover:bg-warning/15 hover:border-warning/40 hover:shadow-elevation-2 hover:-translate-y-0.5',
        )}
      >
        <span
          className={cn(
            'flex items-center justify-center w-5 h-5 rounded-full',
            activeHelp === 'hint' ? 'bg-warning/25' : 'bg-warning/20',
          )}
        >
          <Lightbulb className="w-3.5 h-3.5" />
        </span>
        {hintLabel}
      </motion.button>

      {/* Guiding Question Button — always purple colored */}
      <motion.button
        type="button"
        onClick={onGuidingClick}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          'flex items-center gap-content-gap-xs px-4 py-2 rounded-full text-body-xs font-medium transition-colors duration-normal border shadow-elevation-1',
          activeHelp === 'guiding'
            ? 'bg-accent/15 border-accent/40 text-accent shadow-[inset_0_0_8px_hsl(var(--accent)/0.15)]'
            : 'bg-accent/10 border-accent/30 text-accent/80 hover:bg-accent/15 hover:border-accent/40 hover:shadow-elevation-2 hover:-translate-y-0.5',
        )}
      >
        <span
          className={cn(
            'flex items-center justify-center w-5 h-5 rounded-full',
            activeHelp === 'guiding' ? 'bg-accent/25' : 'bg-accent/20',
          )}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </span>
        {guidingLabel}
      </motion.button>

      {/* Solution Button — hidden until unlocked */}
      <AnimatePresence>
        {helpUsage.solutionUnlocked && (
          <motion.button
            type="button"
            onClick={onSolutionClick}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'flex items-center gap-content-gap-xs px-4 py-2 rounded-full text-body-xs font-medium transition-colors duration-normal border shadow-elevation-1',
              activeHelp === 'solution'
                ? 'bg-primary/15 border-primary/40 text-primary shadow-[inset_0_0_8px_hsl(var(--primary)/0.15)]'
                : 'bg-primary/10 border-primary/30 text-primary/80 hover:bg-primary/15 hover:border-primary/40 hover:shadow-elevation-2 hover:-translate-y-0.5',
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center w-5 h-5 rounded-full',
                activeHelp === 'solution' ? 'bg-primary/25' : 'bg-primary/20',
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
            {solutionLabel}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
