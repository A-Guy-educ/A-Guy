/**
 * Exercise Renderer - Block-Based
 * Renders exercises with mixed content and question blocks
 * Each question block has its own answer UI
 */

'use client'

import React, { useMemo, useRef, useState } from 'react'
import { cn } from '@/infra/utils/ui'
import { useTranslations, useLocale } from '@/ui/web/providers/I18n'
import { Card } from '@/ui/web/components/card'
import { XCircle } from 'lucide-react'
import type {
  ExerciseRendererProps,
  ContentBlock,
  QuestionBlock,
  QuestionSelectTrueFalseBlock,
  QuestionSelectMcqBlock,
  QuestionFreeResponseBlock,
  QuestionTableBlock,
  QuestionMatchingBlock,
  SvgBlock,
  MediaBlock,
  UserAnswer,
  CheckResult,
} from '../types'
import type { GeometrySpecV1, AxisSpecV1 } from '@/infra/contracts'
import { HtmlBlockRenderer } from '../blocks/HtmlBlockRenderer'
import { RichTextRenderer } from '../blocks/RichTextRenderer'
import { SvgRenderer } from '../blocks/SvgRenderer'
import { GeometryRenderer } from '../blocks/GeometryRenderer'
import { AxisRenderer, type DisplaySize } from '../blocks/AxisRenderer'
import { TrueFalseQuestion } from '../questions/TrueFalseQuestion'
import { McqQuestion } from '../questions/McqQuestion'
import { FreeResponseQuestion } from '../questions/FreeResponseQuestion'
import { TableQuestion } from '../questions/TableQuestion'
import { MatchingQuestion } from '../questions/MatchingQuestion'
import { QuestionCard } from '../components/QuestionCard'
import { HelpSystem } from '../components/HelpSystem'
import { useHelpSystem } from '../hooks/useHelpSystem'
import {
  checkQuestionAnswer,
  getInitialAnswer,
  checkSvgAnswer,
  getInitialSvgAnswer,
  type AnswerErrorMessages,
} from '../utils/answerChecking'
import { MediaMapProvider } from '../context/MediaMapContext'
import { VideoPlayer } from '../components/VideoPlayer'
import { getMediaUrl } from '@/infra/utils/getMediaUrl'

/**
 * Hebrew letters for question numbering
 */
const HEBREW_LETTERS = [
  'א',
  'ב',
  'ג',
  'ד',
  'ה',
  'ו',
  'ז',
  'ח',
  'ט',
  'י',
  'כ',
  'ל',
  'מ',
  'נ',
  'ס',
  'ע',
  'פ',
  'צ',
  'ק',
  'ר',
  'ש',
  'ת',
]

/**
 * Get English letter for question index (a, b, c, ...)
 */
function getEnglishLetter(index: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + (index - 1))
}

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
  if (answer.type === 'matching') {
    return answer.connections.map((c) => `${c.leftId} → ${c.rightId}`).join(', ')
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
  exerciseNumber = 1,
  lessonId = '',
  exerciseId = '',
}: ExerciseRendererProps) {
  const t = useTranslations('courses')
  const locale = useLocale()

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
      block.type === 'question_table' ||
      block.type === 'question_matching',
  ) as QuestionBlock[]

  // Help system state (hint/guiding/solution per question)
  const { helpUsage, activeHelp, handleHintClick, handleGuidingClick, handleSolutionClick } =
    useHelpSystem({
      questionBlocks,
      lessonId,
      exerciseId,
      locale: locale ?? undefined,
    })

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

  // SVG hotspot state (interactive SVGs are separate from QuestionBlock flow)
  const [svgAnswers, setSvgAnswers] = useState<Record<string, UserAnswer>>({})
  const [svgCheckResults, setSvgCheckResults] = useState<Record<string, CheckResult>>({})

  const handleSvgHotspotToggle = (blockId: string, hotspotId: string) => {
    setSvgAnswers((prev) => {
      const current = prev[blockId] ?? getInitialSvgAnswer()
      if (current.type !== 'svg') return prev
      const ids = current.selectedHotspotIds.includes(hotspotId)
        ? current.selectedHotspotIds.filter((id) => id !== hotspotId)
        : [...current.selectedHotspotIds, hotspotId]
      return { ...prev, [blockId]: { type: 'svg', selectedHotspotIds: ids } }
    })
  }

  const handleSvgCheck = (blockId: string, block: SvgBlock) => {
    const answer = svgAnswers[blockId] ?? getInitialSvgAnswer()
    if (answer.type !== 'svg') return
    const result = checkSvgAnswer(block, answer.selectedHotspotIds, errorMessages)
    setSvgCheckResults((prev) => ({ ...prev, [blockId]: result }))
  }

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

  // Determine direction based on locale
  // NOTE: Section label language is determined ONLY by locale prefix.
  // Hebrew: א/ב/ג..., English: a/b/c... (lowercase).
  const isHebrew = locale?.toLowerCase().startsWith('he')
  const dir: 'ltr' | 'rtl' = isHebrew ? 'rtl' : 'ltr'

  return (
    <MediaMapProvider value={mediaMap}>
      <div className={cn('w-full max-w-3xl mx-auto', className)}>
        {/* Exercise Number Bubble - shown once at the top */}
        {/* NOTE: We intentionally avoid flex-row-reverse here because it inverts the bubble
             position depending on DOM order. Instead we pin the bubble via auto margins. */}
        <div className="w-full flex items-center justify-between mb-6">
          <div
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center bg-slate-50 border border-slate-200 shadow-sm',
              isHebrew ? 'ml-auto' : 'mr-auto',
            )}
          >
            <span className="font-bold text-sm">{String(exerciseNumber)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {(() => {
            let questionIndex = 0
            return content.blocks.map((block) => {
              // Geometry/Axis — media-only display blocks (type not in ContentBlock union)
              const b = block as ContentBlock & { geometry?: unknown; axis?: unknown }
              if (b.type === ('question_geometry' as string)) {
                return (
                  <div key={b.id}>
                    <GeometryRenderer blockId={b.id} spec={b.geometry as GeometrySpecV1} />
                  </div>
                )
              }
              if (b.type === ('question_axis' as string)) {
                const axisBlock = b as ContentBlock & {
                  axis?: AxisSpecV1
                  displaySize?: DisplaySize
                }
                return (
                  <div key={b.id}>
                    <AxisRenderer
                      blockId={b.id}
                      spec={axisBlock.axis as AxisSpecV1}
                      displaySize={axisBlock.displaySize}
                    />
                  </div>
                )
              }

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

              // SVG block - static or interactive
              if (block.type === 'svg') {
                const svgBlock = block as SvgBlock
                if (svgBlock.interactive && svgBlock.hotspots?.length) {
                  const svgAnswer = svgAnswers[svgBlock.id] ?? getInitialSvgAnswer()
                  const svgResult = svgCheckResults[svgBlock.id] || null
                  const svgDisabled = svgResult?.isCorrect
                  return (
                    <QuestionCard
                      key={svgBlock.id}
                      showCheckButton={showCheckAnswer}
                      onCheckAnswer={() => handleSvgCheck(svgBlock.id, svgBlock)}
                      disabled={!!svgDisabled}
                      loading={false}
                      checked={!!svgResult}
                      checkResult={svgResult}
                      checkAnswerText={t('checkAnswer')}
                      correctText={t('correct')}
                      incorrectText={t('incorrect')}
                    >
                      <SvgRenderer
                        block={svgBlock}
                        selectedHotspotIds={
                          svgAnswer.type === 'svg' ? svgAnswer.selectedHotspotIds : []
                        }
                        onHotspotToggle={(id) => handleSvgHotspotToggle(svgBlock.id, id)}
                        disabled={!!svgDisabled}
                        checkResult={svgResult}
                        correctHotspotIds={svgBlock.correctHotspotIds}
                      />
                    </QuestionCard>
                  )
                }
                return (
                  <div key={svgBlock.id}>
                    <SvgRenderer block={svgBlock} />
                  </div>
                )
              }

              // HTML block - render sanitized HTML
              if (block.type === 'html') {
                return (
                  <div
                    key={block.id}
                    className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed"
                  >
                    <HtmlBlockRenderer block={block} />
                  </div>
                )
              }

              // Media block - render image or video from mediaMap
              if (block.type === 'media') {
                const mediaBlock = block as MediaBlock
                const media = mediaMap[mediaBlock.mediaId]

                if (!media) {
                  return (
                    <div key={mediaBlock.id} className="my-4">
                      <p className="text-sm text-muted-foreground">{t('videoUnavailable')}</p>
                    </div>
                  )
                }

                // Check if media is a video (type field or mimeType starts with 'video/')
                const isVideo = media.type === 'video' || media.mimeType?.startsWith('video/')

                if (isVideo) {
                  return (
                    <div key={mediaBlock.id} className="my-4">
                      <VideoPlayer src={media.url} mimeType={media.mimeType} />
                    </div>
                  )
                }

                // Otherwise render as image (using getMediaUrl for proper URL resolution)
                const imageSrc = getMediaUrl(media.url)
                return (
                  <div
                    key={mediaBlock.id}
                    className="my-4 rounded-xl overflow-hidden border border-border/60 bg-muted/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageSrc}
                      alt={media.alt || media.filename || ''}
                      className="w-full h-auto max-h-96 object-contain"
                    />
                  </div>
                )
              }

              // NOTE: We count question_table as a question so it gets its own section letter.
              // Rich text / latex blocks must NOT increment the counter.
              // Increment question index for question_select, question_free_response, and question_table
              if (
                block.type === 'question_select' ||
                block.type === 'question_free_response' ||
                block.type === 'question_table' ||
                block.type === 'question_matching'
              ) {
                questionIndex++
              }

              // Question blocks - render with answer UI
              const question = block as QuestionBlock

              // Compute question letter label
              const questionLabel = isHebrew
                ? HEBREW_LETTERS[questionIndex - 1] || String(questionIndex)
                : getEnglishLetter(questionIndex)

              const answer = answers[question.id] ?? getInitialAnswer(question)
              const checkResult = checkResults[question.id] || null
              const checked = hasChecked[question.id] || false
              const disabled = checked && checkResult?.isCorrect

              // True/False and Table questions don't use the generic check button
              const showCheckButton =
                showCheckAnswer &&
                !(question.type === 'question_select' && question.variant === 'true_false') &&
                question.type !== 'question_table'

              // Help system for this question (always shown — AI fallback when no backend content)
              const helpSystemNode = (
                <HelpSystem
                  question={question}
                  helpUsage={
                    helpUsage[question.id] ?? {
                      hintShown: false,
                      guidingUsed: false,
                      solutionUnlocked: false,
                    }
                  }
                  activeHelp={activeHelp[question.id] ?? null}
                  onHintClick={() => handleHintClick(question.id)}
                  onGuidingClick={() => handleGuidingClick(question.id)}
                  onSolutionClick={() => handleSolutionClick(question.id)}
                  hintLabel={t('helpHint')}
                  guidingLabel={t('helpGuidingQuestion')}
                  solutionLabel={t('helpSolution')}
                />
              )

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
                  questionLabel={questionLabel}
                  dir={dir}
                  helpSystem={helpSystemNode}
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
                  {question.type === 'question_matching' && (
                    <MatchingQuestion
                      question={question as QuestionMatchingBlock}
                      answer={answer}
                      onChange={(ans) => handleAnswerChange(question.id, ans)}
                      disabled={!!disabled}
                      checkResult={checkResult}
                      t={t}
                    />
                  )}
                </QuestionCard>
              )
            })
          })()}
        </div>
      </div>
    </MediaMapProvider>
  )
}
