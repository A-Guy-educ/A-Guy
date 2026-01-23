/**
 * Question Card Component
 * Wrapper component for question blocks with action buttons and feedback
 */

'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'
import { Button } from '@/ui/components/button'
import { Card } from '@/ui/components/card'
import { CheckCircle2 } from 'lucide-react'
import type { CheckResult } from '../../types'
import { FeedbackDisplay } from '../FeedbackDisplay'

interface QuestionCardProps {
  children: React.ReactNode
  showCheckButton: boolean
  onCheckAnswer: () => void
  disabled: boolean
  checked: boolean
  checkResult: CheckResult | null
  checkAnswerText: string
  correctText: string
  incorrectText: string
}

export function QuestionCard({
  children,
  showCheckButton,
  onCheckAnswer,
  disabled,
  checked,
  checkResult,
  checkAnswerText,
  correctText,
  incorrectText,
}: QuestionCardProps) {
  return (
    <Card
      className={cn(
        'p-card-padding border-2 transition-all duration-normal',
        checked && checkResult?.isCorrect && 'border-success/30 bg-success/5',
      )}
    >
      {/* Question Content */}
      {children}

      {/* Check Answer Button */}
      {showCheckButton && (
        <div className="mt-card-padding flex justify-end">
          <Button
            onClick={onCheckAnswer}
            disabled={disabled}
            size="lg"
            className={cn('font-semibold', disabled && 'bg-success hover:bg-success/90 text-white')}
          >
            {disabled ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {correctText}
              </>
            ) : (
              checkAnswerText
            )}
          </Button>
        </div>
      )}

      {/* Feedback Display */}
      {checked && checkResult && (
        <FeedbackDisplay
          checkResult={checkResult}
          correctText={correctText}
          incorrectText={incorrectText}
        />
      )}
    </Card>
  )
}
