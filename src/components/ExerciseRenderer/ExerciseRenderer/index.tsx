/**
 * Exercise Renderer - Block-Based
 * Renders exercises with mixed content and question blocks
 * Each question block has its own answer UI
 */

'use client'

import React, { useState } from 'react'
import { cn } from '@/utilities/ui'
import { useTranslations } from '@/providers/I18n'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
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
    <div className="space-y-4">
      <div className="text-base font-medium text-foreground leading-relaxed">
        <RichTextRenderer block={promptBlock} />
      </div>
      <div className="flex gap-3">
        {options.map((option) => {
          const isSelected = value === option.value
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
                'flex-1 group relative overflow-hidden',
                'px-6 py-4 rounded-lg',
                'border-2 transition-all duration-200',
                'font-medium text-base',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                !isSelected &&
                  !showFeedback &&
                  'border-border bg-card hover:border-primary hover:bg-primary/5',
                isSelected &&
                  !showFeedback &&
                  'border-primary bg-primary/10 text-primary shadow-sm',
                showFeedback &&
                  isSelected &&
                  checkResult.isCorrect &&
                  'border-[hsl(var(--success))] bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] shadow-sm',
                showFeedback &&
                  isSelected &&
                  !checkResult.isCorrect &&
                  'border-[hsl(var(--error))] bg-[hsl(var(--error))]/10 text-[hsl(var(--error))] shadow-sm',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <RichTextRenderer block={labelBlock} />
                {showFeedback && isSelected && (
                  <span className="text-xl font-bold">
                    {checkResult.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                  </span>
                )}
              </div>
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
    <div className="space-y-4">
      <div className="text-base font-medium text-foreground leading-relaxed">
        <RichTextRenderer block={promptBlock} />
      </div>
      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
        <AlertCircle className="w-4 h-4" />
        {question.answer.multiSelect ? t('selectMultiple') : t('selectOne')}
      </div>
      <div className="space-y-3">
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
                'flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer',
                'transition-all duration-200',
                'hover:border-primary hover:bg-primary/5',
                'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                isSelected ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-card',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
            >
              {question.answer.multiSelect ? (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleOptionClick(option.id)}
                  disabled={disabled}
                  className="mt-0.5"
                />
              ) : (
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center transition-all',
                    isSelected ? 'border-primary bg-primary' : 'border-border bg-background',
                  )}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                </div>
              )}
              <div className="flex-1 text-foreground">
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
    <div className="space-y-4">
      <div className="text-base font-medium text-foreground leading-relaxed">
        <RichTextRenderer block={promptBlock} />
      </div>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange({ type: 'free_response', value: e.target.value })}
        disabled={disabled}
        placeholder={t('enterAnswer')}
        className="text-base py-6"
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
      <div className={cn('w-full max-w-3xl mx-auto', className)}>
        <Card className="p-6 border-[hsl(var(--error))] bg-[hsl(var(--error))]/5">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-[hsl(var(--error))] mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-[hsl(var(--error))] mb-1">
                Invalid Content Format
              </h3>
              <p className="text-sm text-muted-foreground">Expected: {`{ blocks: [] }`}</p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn('w-full max-w-3xl mx-auto', className)}>
      {/* Render all blocks sequentially */}
      <div className="space-y-6">
        {content.blocks.map((block) => {
          // Rich text block - just render content
          if (block.type === 'rich_text') {
            return (
              <div
                key={block.id}
                className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed"
              >
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

          return (
            <Card
              key={question.id}
              className={cn(
                'p-6 border-2 transition-all duration-200',
                checked &&
                  checkResult?.isCorrect &&
                  'border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5',
                checked && !checkResult?.isCorrect && 'border-border',
              )}
            >
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
                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={() => handleCheckAnswer(question.id)}
                      disabled={disabled}
                      size="lg"
                      className={cn(
                        'font-semibold',
                        disabled &&
                          'bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white',
                      )}
                    >
                      {disabled ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          {t('correct')}
                        </>
                      ) : (
                        t('checkAnswer')
                      )}
                    </Button>
                  </div>
                )}

              {/* Check Result Display */}
              {checked && checkResult && (
                <div
                  className={cn(
                    'mt-6 p-4 rounded-lg border-2',
                    checkResult.isCorrect
                      ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))]/10'
                      : 'border-[hsl(var(--error))] bg-[hsl(var(--error))]/10',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {checkResult.isCorrect ? (
                      <CheckCircle2 className="w-6 h-6 text-[hsl(var(--success))] flex-shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-[hsl(var(--error))] flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        'font-semibold text-lg',
                        checkResult.isCorrect
                          ? 'text-[hsl(var(--success))]'
                          : 'text-[hsl(var(--error))]',
                      )}
                    >
                      {checkResult.isCorrect ? t('correct') : t('incorrect')}
                    </span>
                  </div>
                  {checkResult.message && (
                    <p
                      className={cn(
                        'mt-2 text-sm',
                        checkResult.isCorrect
                          ? 'text-[hsl(var(--success))]/80'
                          : 'text-[hsl(var(--error))]/80',
                      )}
                    >
                      {checkResult.message}
                    </p>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
