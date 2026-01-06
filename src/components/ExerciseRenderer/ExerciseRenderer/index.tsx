/**
 * Exercise Renderer - Block-Based
 * Renders exercises with mixed content and question blocks
 * Each question block has its own answer UI
 */

'use client'

import React, { useState } from 'react'
import { cn } from '@/utilities/ui'
import { useTranslations } from '@/providers/I18n'
import type {
  ExerciseRendererProps,
  QuestionBlock,
  QuestionSelectTrueFalseBlock,
  QuestionSelectMcqBlock,
  QuestionFreeResponseBlock,
  UserAnswer,
  CheckResult,
  RichTextBlock,
} from '../types'
import { RichTextRenderer } from '../blocks/RichTextRenderer'
import './index.scss'

const baseClass = 'exercise-renderer'

// Individual question answer checker
function checkQuestionAnswer(question: QuestionBlock, answer: UserAnswer): CheckResult {
  switch (question.type) {
    case 'question_select': {
      // Check variant to determine answer type
      if (question.variant === 'true_false') {
        if (answer.type !== 'true_false') {
          return { isCorrect: false, message: 'Invalid answer type' }
        }
        if (answer.value === null || answer.value === undefined) {
          return { isCorrect: false, message: 'Please select True or False' }
        }
        if (!question.answer.correctOptionId) {
          return { isCorrect: false, message: 'No correct answer defined' }
        }
        // Convert user's boolean answer to option id and compare
        const userOptionId = answer.value ? 'true' : 'false'
        return {
          isCorrect: userOptionId === question.answer.correctOptionId,
        }
      } else if (question.variant === 'mcq') {
        if (answer.type !== 'mcq') {
          return { isCorrect: false, message: 'Invalid answer type' }
        }
        if (answer.selectedIds.length === 0) {
          return { isCorrect: false, message: 'Please select an answer' }
        }
        const userIds = [...answer.selectedIds].sort()
        const correctIds = [...question.answer.correctOptionIds].sort()
        const isCorrect =
          userIds.length === correctIds.length && userIds.every((id, idx) => id === correctIds[idx])
        return { isCorrect }
      }
      return { isCorrect: false, message: 'Unknown question variant' }
    }

    case 'question_free_response': {
      if (answer.type !== 'free_response') {
        return { isCorrect: false, message: 'Invalid answer type' }
      }
      const userValue = answer.value.trim()
      if (userValue === '') {
        return { isCorrect: false, message: 'Please enter an answer' }
      }

      const { acceptedAnswers } = question.answer

      // Case-insensitive matching for all answers
      const normalized = userValue.toLowerCase().trim()
      for (const accepted of acceptedAnswers) {
        if (normalized === accepted.toLowerCase().trim()) {
          return { isCorrect: true }
        }
      }
      return { isCorrect: false }
    }
  }
}

// Get initial answer for a question
function getInitialAnswer(question: QuestionBlock): UserAnswer {
  switch (question.type) {
    case 'question_select':
      if (question.variant === 'true_false') {
        return { type: 'true_false', value: null }
      } else if (question.variant === 'mcq') {
        return { type: 'mcq', selectedIds: [] }
      }
      return { type: 'true_false', value: null } // fallback
    case 'question_free_response':
      return { type: 'free_response', value: '' }
  }
}

// Simple True/False Question UI
function TrueFalseQuestionUI({
  question,
  answer,
  onChange,
  disabled,
  checkResult,
}: {
  question: QuestionSelectTrueFalseBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
}) {
  const value = answer.type === 'true_false' ? answer.value : null

  // Fallback for backward compatibility - generate default options if missing
  const options = question.options || [
    {
      id: 'true' as const,
      value: true as const,
      label: {
        type: 'rich_text' as const,
        format: 'md-math-v1' as const,
        value: 'True',
        mediaIds: [] as string[],
      },
    },
    {
      id: 'false' as const,
      value: false as const,
      label: {
        type: 'rich_text' as const,
        format: 'md-math-v1' as const,
        value: 'False',
        mediaIds: [] as string[],
      },
    },
  ]

  // Convert InlineRichText to RichTextBlock for renderer
  const promptBlock: RichTextBlock = {
    ...question.prompt,
    id: `${question.id}-prompt`,
    mediaIds: question.prompt.mediaIds || [],
  }

  return (
    <div className={`${baseClass}__question-ui`}>
      <div className={`${baseClass}__question-prompt`}>
        <RichTextRenderer block={promptBlock} />
      </div>
      <div className={`${baseClass}__tf-options`}>
        {options.map((option) => {
          const isSelected = value === option.value
          const isCorrectAnswer = question.answer.correctOptionId === option.id
          const showFeedback = checkResult !== null

          const labelBlock: RichTextBlock = {
            ...option.label,
            id: `${question.id}-option-${option.id}`,
            mediaIds: option.label.mediaIds || [],
          }
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ type: 'true_false', value: option.value })}
              disabled={disabled}
              className={cn(
                `${baseClass}__tf-option`,
                isSelected && `${baseClass}__tf-option--selected`,
                showFeedback &&
                  isSelected &&
                  checkResult.isCorrect &&
                  `${baseClass}__tf-option--correct`,
                showFeedback &&
                  isSelected &&
                  !checkResult.isCorrect &&
                  `${baseClass}__tf-option--incorrect`,
                disabled && `${baseClass}__tf-option--disabled`,
              )}
            >
              <RichTextRenderer block={labelBlock} />
              {showFeedback && isSelected && (
                <span className={`${baseClass}__tf-option-icon`}>
                  {checkResult.isCorrect ? '✓' : '✗'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Simple MCQ Question UI
function McqQuestionUI({
  question,
  answer,
  onChange,
  disabled,
  checkResult,
  t,
}: {
  question: QuestionSelectMcqBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
  t: (key: string) => string
}) {
  const selectedIds = answer.type === 'mcq' ? answer.selectedIds : []

  const handleOptionClick = (optionId: string) => {
    if (disabled) return

    let newSelectedIds: string[]
    if (question.answer.multiSelect) {
      newSelectedIds = selectedIds.includes(optionId)
        ? selectedIds.filter((id) => id !== optionId)
        : [...selectedIds, optionId]
    } else {
      newSelectedIds = [optionId]
    }

    onChange({ type: 'mcq', selectedIds: newSelectedIds })
  }

  // Convert InlineRichText to RichTextBlock for renderer
  const promptBlock: RichTextBlock = {
    ...question.prompt,
    id: `${question.id}-prompt`,
    mediaIds: question.prompt.mediaIds || [],
  }

  return (
    <div className={`${baseClass}__question-ui`}>
      <div className={`${baseClass}__question-prompt`}>
        <RichTextRenderer block={promptBlock} />
      </div>
      <div className={`${baseClass}__mcq-instruction`}>
        {question.answer.multiSelect ? t('selectMultiple') : t('selectOne')}
      </div>
      <div className={`${baseClass}__mcq-options`}>
        {question.answer.options.map((option) => {
          const isSelected = selectedIds.includes(option.id)
          const optionBlock: RichTextBlock = {
            ...option.content,
            id: `${question.id}-option-${option.id}`,
            mediaIds: option.content.mediaIds || [],
          }
          return (
            <label
              key={option.id}
              className={cn(
                `${baseClass}__mcq-option`,
                isSelected && `${baseClass}__mcq-option--selected`,
                disabled && `${baseClass}__mcq-option--disabled`,
              )}
            >
              <input
                type={question.answer.multiSelect ? 'checkbox' : 'radio'}
                checked={isSelected}
                onChange={() => handleOptionClick(option.id)}
                disabled={disabled}
                className={`${baseClass}__mcq-input`}
              />
              <div className={`${baseClass}__mcq-content`}>
                <RichTextRenderer block={optionBlock} />
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

// Simple Free Response Question UI
function FreeResponseQuestionUI({
  question,
  answer,
  onChange,
  disabled,
  checkResult,
  t,
}: {
  question: QuestionFreeResponseBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
  t: (key: string) => string
}) {
  const value = answer.type === 'free_response' ? answer.value : ''

  // Convert InlineRichText to RichTextBlock for renderer
  const promptBlock: RichTextBlock = {
    ...question.prompt,
    id: `${question.id}-prompt`,
    mediaIds: question.prompt.mediaIds || [],
  }

  return (
    <div className={`${baseClass}__question-ui`}>
      <div className={`${baseClass}__question-prompt`}>
        <RichTextRenderer block={promptBlock} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange({ type: 'free_response', value: e.target.value })}
        disabled={disabled}
        placeholder={t('enterAnswer')}
        className={`${baseClass}__free-response-input`}
      />
    </div>
  )
}

// Main component
export function ExerciseRenderer({
  content,
  mode = 'student',
  showCheckAnswer = true,
  className = '',
}: ExerciseRendererProps) {
  const t = useTranslations('courses')

  // Track answers and check results for each question block
  const questionBlocks = content.blocks.filter(
    (block) => block.type === 'question_select' || block.type === 'question_free_response',
  ) as QuestionBlock[]

  const [answers, setAnswers] = useState<Record<string, UserAnswer>>(() => {
    const initial: Record<string, UserAnswer> = {}
    questionBlocks.forEach((q) => {
      initial[q.id] = getInitialAnswer(q)
    })
    return initial
  })

  const [checkResults, setCheckResults] = useState<Record<string, CheckResult>>({})
  const [hasChecked, setHasChecked] = useState<Record<string, boolean>>({})

  const handleAnswerChange = (questionId: string, answer: UserAnswer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))

    // For true/false questions, check immediately on selection
    const question = questionBlocks.find((q) => q.id === questionId)
    if (
      question?.type === 'question_select' &&
      answer.type === 'true_false' &&
      answer.value !== null
    ) {
      const result = checkQuestionAnswer(question, answer)
      setCheckResults((prev) => ({ ...prev, [questionId]: result }))
      setHasChecked((prev) => ({ ...prev, [questionId]: true }))
    } else {
      // For other question types, clear the check result
      setCheckResults((prev) => {
        const next = { ...prev }
        delete next[questionId]
        return next
      })
      setHasChecked((prev) => ({ ...prev, [questionId]: false }))
    }
  }

  const handleCheckAnswer = (questionId: string) => {
    const question = questionBlocks.find((q) => q.id === questionId)
    if (!question) return

    const result = checkQuestionAnswer(question, answers[questionId])
    setCheckResults((prev) => ({ ...prev, [questionId]: result }))
    setHasChecked((prev) => ({ ...prev, [questionId]: true }))
  }

  // Validate content structure
  if (!content?.blocks || !Array.isArray(content.blocks)) {
    return (
      <div className={cn(baseClass, className)}>
        <div className={`${baseClass}__error`}>
          <h3>Invalid Content Format</h3>
          <p>Expected: {`{ blocks: [] }`}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(baseClass, className)}>
      {/* Render all blocks sequentially */}
      <div className={`${baseClass}__content`}>
        {content.blocks.map((block) => {
          // Rich text block - just render content
          if (block.type === 'rich_text') {
            return (
              <div key={block.id} className={`${baseClass}__text-block`}>
                <RichTextRenderer block={block} />
              </div>
            )
          }

          // Question blocks - render with answer UI
          const question = block as QuestionBlock
          const answer = answers[question.id]
          const checkResult = checkResults[question.id] || null
          const checked = hasChecked[question.id] || false
          const disabled = checked && checkResult?.isCorrect

          // Debug logging
          if (question.type === 'question_select') {
            console.log('Question Select Block:', {
              id: question.id,
              type: question.type,
              hasVariant: 'variant' in question,
              variant: (question as any).variant,
              hasOptions: 'options' in question,
              options: (question as any).options,
              question: question,
            })
          }

          return (
            <div key={question.id} className={`${baseClass}__question-block`}>
              {/* Question UI based on type and variant */}
              {question.type === 'question_select' && question.variant === 'true_false' && (
                <TrueFalseQuestionUI
                  question={question as QuestionSelectTrueFalseBlock}
                  answer={answer}
                  onChange={(ans) => handleAnswerChange(question.id, ans)}
                  disabled={!!disabled}
                  checkResult={checkResult}
                />
              )}
              {question.type === 'question_select' && question.variant === 'mcq' && (
                <McqQuestionUI
                  question={question as QuestionSelectMcqBlock}
                  answer={answer}
                  onChange={(ans) => handleAnswerChange(question.id, ans)}
                  disabled={!!disabled}
                  checkResult={checkResult}
                  t={t}
                />
              )}
              {question.type === 'question_free_response' && (
                <FreeResponseQuestionUI
                  question={question as QuestionFreeResponseBlock}
                  answer={answer}
                  onChange={(ans) => handleAnswerChange(question.id, ans)}
                  disabled={!!disabled}
                  checkResult={checkResult}
                  t={t}
                />
              )}

              {/* Check Answer Button - hidden for true/false variant (immediate feedback) */}
              {showCheckAnswer &&
                !(question.type === 'question_select' && question.variant === 'true_false') && (
                  <div className={`${baseClass}__check-button-wrapper`}>
                    <button
                      onClick={() => handleCheckAnswer(question.id)}
                      disabled={disabled}
                      className={cn(
                        `${baseClass}__check-button`,
                        disabled && `${baseClass}__check-button--correct`,
                      )}
                    >
                      {disabled ? `✓ ${t('correct')}` : t('checkAnswer')}
                    </button>
                  </div>
                )}

              {/* Check Result Display */}
              {checked && checkResult && (
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
                      {checkResult.isCorrect ? t('correct') : t('incorrect')}
                    </span>
                  </div>
                  {checkResult.message && (
                    <div className={`${baseClass}__result-message`}>{checkResult.message}</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
