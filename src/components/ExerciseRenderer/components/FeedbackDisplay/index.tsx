/**
 * Feedback Display Component
 * Shows feedback after a user checks their answer
 */

'use client'

import React from 'react'
import { cn } from '@/utilities/ui'
import { CheckCircle2, XCircle } from 'lucide-react'
import type { CheckResult } from '../../types'
import './index.scss'

interface FeedbackDisplayProps {
  checkResult: CheckResult
  correctText: string
  incorrectText: string
}

export function FeedbackDisplay({ checkResult, correctText, incorrectText }: FeedbackDisplayProps) {
  return (
    <div
      className={cn(
        'feedback-display',
        checkResult.isCorrect ? 'feedback-display--correct' : 'feedback-display--incorrect',
      )}
    >
      <div className="feedback-display__content">
        {checkResult.isCorrect ? (
          <CheckCircle2 className="feedback-display__icon" />
        ) : (
          <XCircle className="feedback-display__icon" />
        )}
        <span className="feedback-display__text">
          {checkResult.isCorrect ? correctText : incorrectText}
        </span>
      </div>
      {checkResult.message && <p className="feedback-display__message">{checkResult.message}</p>}
    </div>
  )
}
