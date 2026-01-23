/**
 * Feedback Display Component
 * Shows feedback after a user checks their answer
 */

'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'
import { CheckCircle2, XCircle } from 'lucide-react'
import type { CheckResult } from '../../types'

interface FeedbackDisplayProps {
  checkResult: CheckResult
  correctText: string
  incorrectText: string
}

export function FeedbackDisplay({ checkResult, correctText, incorrectText }: FeedbackDisplayProps) {
  return (
    <div
      className={cn(
        'mt-card-padding p-4 rounded-lg border-2',
        checkResult.isCorrect ? 'border-success bg-success/10' : 'border-error bg-error/10',
      )}
    >
      <div className="flex items-center gap-2">
        {checkResult.isCorrect ? (
          <CheckCircle2 className="w-6 h-6 shrink-0 text-success" />
        ) : (
          <XCircle className="w-6 h-6 shrink-0 text-error" />
        )}
        <span
          className={cn(
            'font-semibold text-lg',
            checkResult.isCorrect ? 'text-success' : 'text-error',
          )}
        >
          {checkResult.isCorrect ? correctText : incorrectText}
        </span>
      </div>
      {checkResult.message && (
        <p
          className={cn(
            'mt-2 text-sm',
            checkResult.isCorrect ? 'text-success/80' : 'text-error/80',
          )}
        >
          {checkResult.message}
        </p>
      )}
    </div>
  )
}
