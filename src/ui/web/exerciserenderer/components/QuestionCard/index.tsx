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
          'p-card-padding shadow-elevation-1 transition-all duration-normal',
          isCorrect && 'border-s-3 border-s-success bg-success/5',
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
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20 shadow-elevation-1"
            >
              <span className="font-bold text-body-sm text-primary">{questionLabel}</span>
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
