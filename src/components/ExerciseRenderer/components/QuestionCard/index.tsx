/**
 * Question Card Component
 * Wrapper component for question blocks with action buttons and feedback
 */

'use client'

import React from 'react'
import { cn } from '@/utilities/ui'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'
import type { CheckResult } from '../../types'
import { FeedbackDisplay } from '../FeedbackDisplay'
import './index.scss'

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
      className={cn('question-card', checked && checkResult?.isCorrect && 'question-card--correct')}
    >
      {/* Question Content */}
      {children}

      {/* Check Answer Button */}
      {showCheckButton && (
        <div className="question-card__actions">
          <Button
            onClick={onCheckAnswer}
            disabled={disabled}
            size="lg"
            className={cn('question-card__button', disabled && 'question-card__button--success')}
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
