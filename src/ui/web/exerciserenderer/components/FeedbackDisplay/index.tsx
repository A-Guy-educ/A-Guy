/**
 * Feedback Display Component
 * Shows animated feedback after a user checks their answer
 */

'use client'

import React, { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/infra/utils/ui'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Confetti } from '@/ui/web/components/confetti'
import type { CheckResult } from '../../types'

const EASE_OUT = [0.25, 0.46, 0.45, 0.94] as const

interface FeedbackDisplayProps {
  checkResult: CheckResult
  correctText: string
  incorrectText: string
}

export function FeedbackDisplay({ checkResult, correctText, incorrectText }: FeedbackDisplayProps) {
  const hasFiredConfetti = useRef(false)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (checkResult.isCorrect && !hasFiredConfetti.current) {
      hasFiredConfetti.current = true
      setShowConfetti(true)
    }
  }, [checkResult.isCorrect])

  const shakeAnimation = !checkResult.isCorrect ? { x: [0, -6, 6, -4, 4, 0] } : {}

  return (
    <>
      <Confetti active={showConfetti} duration={2500} />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, ...shakeAnimation }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.35, ease: EASE_OUT }}
        className={cn(
          'mt-4 p-card-padding-sm rounded-xl border',
          checkResult.isCorrect ? 'border-success/20 bg-success/8' : 'border-error/20 bg-error/8',
        )}
      >
        <div className="flex items-center gap-3">
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.15 }}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full shrink-0',
              checkResult.isCorrect ? 'bg-success/15' : 'bg-error/15',
            )}
          >
            {checkResult.isCorrect ? (
              <CheckCircle2 className="w-5 h-5 text-success" />
            ) : (
              <XCircle className="w-5 h-5 text-error" />
            )}
          </motion.span>
          <span
            className={cn(
              'font-bold text-heading-sm',
              checkResult.isCorrect ? 'text-success' : 'text-error',
            )}
          >
            {checkResult.isCorrect ? correctText : incorrectText}
          </span>
        </div>
        {checkResult.message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.25 }}
            className={cn(
              'mt-2 ms-11 text-body-sm',
              checkResult.isCorrect ? 'text-success/70' : 'text-error/70',
            )}
          >
            {checkResult.message}
          </motion.p>
        )}
      </motion.div>
    </>
  )
}
