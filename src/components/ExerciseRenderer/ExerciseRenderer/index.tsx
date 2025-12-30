/**
 * Exercise Renderer
 * Main component that renders complete exercises with content blocks and answer UI
 */

'use client'

import React, { useState } from 'react'
import { cn } from '@/utilities/ui'
import type { ExerciseRendererProps, UserAnswer, CheckResult } from '../types'
import { BlockRenderer } from '../blocks/BlockRenderer'
import { AnswerRenderer } from '../answers/AnswerRenderer'
import { checkAnswer } from '../utils/checkAnswer'
import { ErrorBoundary } from '../ErrorBoundary'
import './index.scss'

const baseClass = 'exercise-renderer'

export function ExerciseRenderer({
  content,
  answerSpec,
  questionType,
  mode = 'student',
  showCheckAnswer = true,
  onAnswerChange,
  initialAnswer,
  className = '',
}: ExerciseRendererProps) {
  // Initialize user answer based on question type
  const getInitialAnswer = (): UserAnswer => {
    if (initialAnswer) return initialAnswer

    switch (questionType) {
      case 'mcq':
        return { type: 'mcq', selectedIds: [] }
      case 'true_false':
        return { type: 'true_false', value: null }
      case 'free_response':
        return { type: 'free_response', value: '' }
      default:
        return { type: 'free_response', value: '' }
    }
  }

  const [userAnswer, setUserAnswer] = useState<UserAnswer>(getInitialAnswer())
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
  const [hasChecked, setHasChecked] = useState(false)

  const handleAnswerChange = (newAnswer: UserAnswer) => {
    setUserAnswer(newAnswer)
    setCheckResult(null) // Clear result when answer changes
    setHasChecked(false)
    onAnswerChange?.(newAnswer)
  }

  const handleCheckAnswer = () => {
    const result = checkAnswer(answerSpec, userAnswer)
    setCheckResult(result)
    setHasChecked(true)
  }

  return (
    <div className={cn(baseClass, className)}>
      {/* Debug Mode Info */}
      {mode === 'debug' && (
        <div className={`${baseClass}__debug-info`}>
          <div className={`${baseClass}__debug-title`}>Debug Mode</div>
          <div>Question Type: {questionType}</div>
          <div>Answer Spec Type: {answerSpec.questionType}</div>
          {answerSpec.questionType === 'free_response' && (
            <div>Response Kind: {answerSpec.responseKind}</div>
          )}
        </div>
      )}

      {/* Content Section */}
      <div className={`${baseClass}__content`}>
        <ErrorBoundary fallbackTitle="Error rendering exercise content">
          {/* Render stem blocks */}
          {content.stem && content.stem.length > 0 ? (
            content.stem.map((block) => <BlockRenderer key={block.id} block={block} mode={mode} />)
          ) : (
            <div className={`${baseClass}__empty`}>No content blocks</div>
          )}

          {/* Render sections if present (not fully implemented in v0) */}
          {content.sections && content.sections.length > 0 && (
            <div className={`${baseClass}__sections-note`}>
              Note: Multi-section exercises are not fully supported in this preview
            </div>
          )}
        </ErrorBoundary>
      </div>

      {/* Answer Section */}
      <div className={`${baseClass}__answer-section`}>
        <h3 className={`${baseClass}__answer-title`}>Your Answer</h3>

        <AnswerRenderer
          answerSpec={answerSpec}
          value={userAnswer}
          onChange={handleAnswerChange}
          disabled={hasChecked && checkResult?.isCorrect}
          mode={mode}
        />

        {/* Check Answer Button */}
        {showCheckAnswer && (
          <div className={`${baseClass}__check-button-wrapper`}>
            <button
              onClick={handleCheckAnswer}
              disabled={hasChecked && checkResult?.isCorrect}
              className={cn(
                `${baseClass}__check-button`,
                hasChecked && checkResult?.isCorrect && `${baseClass}__check-button--correct`,
              )}
            >
              {hasChecked && checkResult?.isCorrect ? '✓ Correct!' : 'Check Answer'}
            </button>
          </div>
        )}

        {/* Check Result Display */}
        {hasChecked && checkResult && (
          <div
            className={cn(
              `${baseClass}__result`,
              checkResult.isCorrect
                ? `${baseClass}__result--correct`
                : `${baseClass}__result--incorrect`,
            )}
          >
            <div className={`${baseClass}__result-header`}>
              <span className={`${baseClass}__result-icon`}>
                {checkResult.isCorrect ? '✓' : '✗'}
              </span>
              <span className={`${baseClass}__result-text`}>
                {checkResult.isCorrect ? 'Correct!' : 'Incorrect'}
              </span>
            </div>
            {checkResult.message && (
              <div className={`${baseClass}__result-message`}>{checkResult.message}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
