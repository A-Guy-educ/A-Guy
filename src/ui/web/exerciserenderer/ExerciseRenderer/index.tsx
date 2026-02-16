/**
 * Exercise Renderer - Block-Based
 * Renders exercises with mixed content and question blocks
 * Each question block has its own answer UI
 */

'use client'

import React, { useMemo, useRef, useState } from 'react'
import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Card } from '@/ui/web/components/card'
import { XCircle } from 'lucide-react'
import type {
  ExerciseRendererProps,
  QuestionBlock,
  QuestionSelectTrueFalseBlock,
  QuestionSelectMcqBlock,
  QuestionFreeResponseBlock,
  QuestionTableBlock,
  UserAnswer,
  CheckResult,
} from '../types'
import { RichTextRenderer } from '../blocks/RichTextRenderer'
import { TrueFalseQuestion } from '../questions/TrueFalseQuestion'
import { McqQuestion } from '../questions/McqQuestion'
import { FreeResponseQuestion } from '../questions/FreeResponseQuestion'
import { TableQuestion } from '../questions/TableQuestion'
import { QuestionCard } from '../components/QuestionCard'
import {
  checkQuestionAnswer,
  getInitialAnswer,
  type AnswerErrorMessages,
} from '../utils/answerChecking'
import { MediaMapProvider } from '../context/MediaMapContext'

/**
 * Format student's answer as readable text for AI context
 */
function formatStudentAnswer(question: QuestionBlock, answer: UserAnswer): string {
  if (answer.type === 'true_false') {
    return answer.value === true ? 'True' : 'False'
  }
  if (answer.type === 'mcq' && question.type === 'question_select' && question.variant === 'mcq') {
    const selected = question.answer.options.filter((o) => answer.selectedIds.includes(o.id))
    return selected.map((o) => o.content.value).join(', ')
  }
  if (answer.type === 'free_response') {
    return answer.value
  }
  if (answer.type === 'table') {
    return Object.entries(answer.cellValues)
      .map(([key, val]) => `[${key}]: ${val}`)
      .join(', ')
  }
  return ''
}

/**
 * Main Exercise Renderer Component
 */
const EMPTY_MEDIA_MAP = {} as const

export function ExerciseRenderer({
  content,
  mode: _mode = 'student',
  showCheckAnswer = true,
  className = '',
  mediaMap = EMPTY_MEDIA_MAP,
}: ExerciseRendererProps) {
  const t = useTranslations('courses')

  const errorMessages: AnswerErrorMessages = useMemo(
    () => ({
      invalidAnswerType: t('invalidAnswerType'),
      selectTrueFalse: t('selectTrueFalse'),
      noCorrectAnswer: t('noCorrectAnswer'),
      selectAnAnswer: t('selectAnAnswer'),
      enterAnAnswer: t('enterAnAnswer'),
      unknownVariant: t('unknownVariant'),
      validationFailed: t('validationFailed'),
      validationError: t('validationError'),
      connectionError: t('connectionError'),
    }),
    [t],
  )

  // Track answers and check results for each question block
  const questionBlocks = content.blocks.filter(
    (block) =>
      block.type === 'question_select' ||
      block.type === 'question_free_response' ||
      block.type === 'question_table',
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
  const [isChecking, setIsChecking] = useState<Record<string, boolean>>({})
  const chatTriggeredRef = useRef<Set<string>>(new Set())

  const handleAnswerChange = async (questionId: string, answer: UserAnswer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))

    // For true/false questions, check immediately on selection
    const question = questionBlocks.find((q) => q.id === questionId)
    if (
      question?.type === 'question_select' &&
      answer.type === 'true_false' &&
      answer.value !== null
    ) {
      const result = await checkQuestionAnswer(question, answer, errorMessages)
      setCheckResults((prev) => ({ ...prev, [questionId]: result }))
      setHasChecked((prev) => ({ ...prev, [questionId]: true }))
      if (!result.isCorrect && !chatTriggeredRef.current.has(questionId)) {
        chatTriggeredRef.current.add(questionId)
        window.dispatchEvent(
          new CustomEvent('exercise-incorrect-answer', {
            detail: {
              questionJson: JSON.stringify(question),
              studentAnswer: formatStudentAnswer(question, answer),
            },
          }),
        )
      }
    } else {
      // For other question types, clear the check result (chat trigger stays — one per question)
      setCheckResults((prev) => {
        const next = { ...prev }
        delete next[questionId]
        return next
      })
      setHasChecked((prev) => ({ ...prev, [questionId]: false }))
    }
  }

  const handleCheckAnswer = async (questionId: string) => {
    const question = questionBlocks.find((q) => q.id === questionId)
    if (!question) return

    setIsChecking((prev) => ({ ...prev, [questionId]: true }))
    try {
      const result = await checkQuestionAnswer(question, answers[questionId], errorMessages)
      setCheckResults((prev) => ({ ...prev, [questionId]: result }))
      setHasChecked((prev) => ({ ...prev, [questionId]: true }))
      if (!result.isCorrect && !chatTriggeredRef.current.has(questionId)) {
        chatTriggeredRef.current.add(questionId)
        window.dispatchEvent(
          new CustomEvent('exercise-incorrect-answer', {
            detail: {
              questionJson: JSON.stringify(question),
              studentAnswer: formatStudentAnswer(question, answers[questionId]),
            },
          }),
        )
      }
    } finally {
      setIsChecking((prev) => ({ ...prev, [questionId]: false }))
    }
  }

  const handleTableCheckResult = (questionId: string, isCorrect: boolean) => {
    setCheckResults((prev) => ({ ...prev, [questionId]: { isCorrect } }))
    setHasChecked((prev) => ({ ...prev, [questionId]: true }))
    if (!isCorrect && !chatTriggeredRef.current.has(questionId)) {
      chatTriggeredRef.current.add(questionId)
      const question = questionBlocks.find((q) => q.id === questionId)
      window.dispatchEvent(
        new CustomEvent('exercise-incorrect-answer', {
          detail: {
            questionJson: JSON.stringify(question),
            studentAnswer: formatStudentAnswer(question!, answers[questionId]),
          },
        }),
      )
    }
  }

  // Validate content structure
  if (!content?.blocks || !Array.isArray(content.blocks)) {
    return (
      <div className={cn('w-full max-w-3xl mx-auto', className)}>
        <Card className="p-6 border-destructive bg-destructive/5">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-destructive mb-1">
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
    <MediaMapProvider value={mediaMap}>
      <div className={cn('w-full max-w-3xl mx-auto', className)}>
        <div className="flex flex-col gap-6">
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
            const answer = answers[question.id] ?? getInitialAnswer(question)
            const checkResult = checkResults[question.id] || null
            const checked = hasChecked[question.id] || false
            const disabled = checked && checkResult?.isCorrect

            // True/False and Table questions don't use the generic check button
            const showCheckButton =
              showCheckAnswer &&
              !(question.type === 'question_select' && question.variant === 'true_false') &&
              question.type !== 'question_table'

            return (
              <QuestionCard
                key={question.id}
                showCheckButton={showCheckButton}
                onCheckAnswer={() => handleCheckAnswer(question.id)}
                disabled={!!disabled}
                loading={!!isChecking[question.id]}
                checked={checked}
                checkResult={checkResult}
                checkAnswerText={t('checkAnswer')}
                correctText={t('correct')}
                incorrectText={t('incorrect')}
              >
                {/* Render appropriate question component based on type */}
                {question.type === 'question_select' && question.variant === 'true_false' && (
                  <TrueFalseQuestion
                    question={question as QuestionSelectTrueFalseBlock}
                    answer={answer}
                    onChange={(ans) => handleAnswerChange(question.id, ans)}
                    disabled={!!disabled}
                    checkResult={checkResult}
                  />
                )}
                {question.type === 'question_select' && question.variant === 'mcq' && (
                  <McqQuestion
                    question={question as QuestionSelectMcqBlock}
                    answer={answer}
                    onChange={(ans) => handleAnswerChange(question.id, ans)}
                    disabled={!!disabled}
                    checkResult={checkResult}
                    t={t}
                  />
                )}
                {question.type === 'question_free_response' && (
                  <FreeResponseQuestion
                    question={question as QuestionFreeResponseBlock}
                    answer={answer}
                    onChange={(ans) => handleAnswerChange(question.id, ans)}
                    disabled={!!disabled}
                    checkResult={checkResult}
                    t={t}
                  />
                )}
                {question.type === 'question_table' && (
                  <TableQuestion
                    question={question as QuestionTableBlock}
                    answer={answer}
                    onChange={(ans) => handleAnswerChange(question.id, ans)}
                    disabled={!!disabled}
                    checked={checked}
                    allCorrect={!!disabled}
                    onCheckResult={(correct) => handleTableCheckResult(question.id, correct)}
                    t={t}
                  />
                )}
              </QuestionCard>
            )
          })}
        </div>
      </div>
    </MediaMapProvider>
  )
}
