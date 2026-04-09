/**
 * Question Card Component
 * Wrapper component for question blocks with action buttons and feedback
 */

'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/infra/utils/ui'
import { Button } from '@/ui/web/components/button'
import { Card } from '@/ui/web/components/card'
import { CheckCircle2, Loader2 } from 'lucide-react'
import type { CheckResult } from '../../types'
import { FeedbackDisplay } from '../FeedbackDisplay'

const EASE_OUT = [0.25, 0.46, 0.45, 0.94] as const

interface QuestionCardProps {
  children: React.ReactNode
  showCheckButton: boolean
  onCheckAnswer: () => void
  disabled: boolean
  loading?: boolean
  checked: boolean
  checkResult: CheckResult | null
  checkAnswerText: string
  correctText: string
  incorrectText: string
  questionLabel?: string
  dir?: 'ltr' | 'rtl'
  /** Optional help system UI (hint/guiding/solution buttons) */
  helpSystem?: React.ReactNode
  /** Delay for staggered entrance animation (seconds) */
  animationDelay?: number
}

export function QuestionCard({
  children,
  showCheckButton,
  onCheckAnswer,
  disabled,
  loading = false,
  checked,
  checkResult,
  checkAnswerText,
  correctText,
  incorrectText,
  questionLabel,
  dir = 'ltr',
  helpSystem,
  animationDelay = 0,
}: QuestionCardProps) {
  const isCorrect = checked && checkResult?.isCorrect

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT, delay: animationDelay }}
    >
      <Card
        className={cn(
          'p-card-padding border border-border/40 transition-all duration-normal',
          // Light mode: translucent bg so it blends with warm cream page — no floating effect
          'bg-background/70 [data-theme="light"]:bg-background/70 dark:bg-card',
          // Dark mode: slight elevation with shadow
          'dark:shadow-card',
          isCorrect && 'border-success/30 bg-success/5',
        )}
      >
        {/* Question Label */}
        {questionLabel && (
          <div
            className={cn(
              'w-full flex items-center mb-4',
              dir === 'rtl'
                ? 'justify-end text-right flex-row-reverse gap-content-gap-xs'
                : 'justify-start text-left gap-content-gap-xs',
            )}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 20,
                delay: animationDelay + 0.2,
              }}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/10 border-2 border-primary/20 shadow-card"
            >
              <span className="font-extrabold text-body-sm text-primary tracking-tight">
                {questionLabel}
              </span>
            </motion.div>
          </div>
        )}

        {/* Question Content */}
        {children}

        {/* Help System (hint/guiding/solution) */}
        {helpSystem}

        {/* Action Area */}
        {(showCheckButton || (checked && checkResult)) && (
          <div className="border-t border-border/20 pt-4 mt-5">
            {/* Check Answer Button */}
            {showCheckButton && (
              <div className="flex justify-end">
                <Button
                  onClick={onCheckAnswer}
                  disabled={disabled || loading}
                  size="lg"
                  className={cn(
                    'rounded-xl font-bold text-body-md',
                    disabled && 'bg-success hover:bg-success/90 text-white',
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 me-2 animate-spin" />
                      {checkAnswerText}
                    </>
                  ) : disabled ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 me-2" />
                      {correctText}
                    </>
                  ) : (
                    checkAnswerText
                  )}
                </Button>
              </div>
            )}

            {/* Feedback Display */}
            <AnimatePresence mode="wait">
              {checked && checkResult && (
                <FeedbackDisplay
                  key={checkResult.isCorrect ? 'correct' : 'incorrect'}
                  checkResult={checkResult}
                  correctText={correctText}
                  incorrectText={incorrectText}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
