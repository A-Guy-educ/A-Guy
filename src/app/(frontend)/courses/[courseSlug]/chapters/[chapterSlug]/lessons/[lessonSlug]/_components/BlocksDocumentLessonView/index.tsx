/**
 * BlocksDocumentLessonView
 *
 * Renders a lesson's exercises as a single scroll-style document (the "Scroll
 * tab"). Each exercise's structured blocks (`exercise.content.blocks`) are
 * laid out worksheet-style via ExerciseWorksheet — same source of truth as
 * the Interactive tab, just non-interactive and styled as a clean card.
 *
 * Solutions (fullSolution/solution) from question blocks are collected into
 * a single "Solutions" section rendered AFTER all exercises.
 *
 * Text alignment is locale-aware: right-aligned for Hebrew (RTL), left-aligned
 * for English (LTR).
 */

'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'
import { ExerciseWorksheet } from '@/ui/web/exerciserenderer/ExerciseWorksheet'
import { RichTextRenderer } from '@/ui/web/exerciserenderer/blocks/RichTextRenderer'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import type { Exercise, Media as MediaType } from '@/payload-types'
import type { QuestionBlock, InlineRichText, RichTextBlock } from '@/ui/web/exerciserenderer/types'
import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { HEBREW_LETTERS } from '@/ui/web/exerciserenderer/constants'

type WorksheetBlocks = React.ComponentProps<typeof ExerciseWorksheet>['blocks']

interface BlocksDocumentLessonViewProps {
  lessonTitle: string
  backUrl: string
  exercises: Exercise[]
  mediaMap?: Record<string, MediaType>
  /** Optional element rendered at the top of the primary pane (e.g. tab bar). */
  headerSlot?: React.ReactNode
  chatContent?: React.ReactNode
}

function getBlocks(exercise: Exercise): WorksheetBlocks {
  const content = exercise.content as { blocks?: unknown } | null | undefined
  if (!content || !Array.isArray(content.blocks)) return []
  return content.blocks as WorksheetBlocks
}

type ExerciseSolutionEntry = {
  exerciseId: string
  exerciseLabel: string
  exerciseTitle?: string | null
  solutions: { blockId: string; subLabel: string | null; content: InlineRichText }[]
}

const QUESTION_BLOCK_TYPES = new Set([
  'question_select',
  'question_free_response',
  'question_table',
  'question_matching',
  'question_geometry',
  'question_axis',
])

/**
 * Collects solutions grouped by exercise. Exercise numbering matches the
 * exercise's position in the lesson (1-based) regardless of whether earlier
 * exercises had solutions, so the solution number lines up with the exercise
 * the student is reading.
 *
 * Within an exercise that has multiple solved sub-questions, each sub-solution
 * gets a sub-label (א./ב./ג. in RTL, a./b./c. in LTR). A single solution per
 * exercise renders without a sub-label.
 */
function getSolutionsByExercise(
  exercises: Exercise[],
  locale: string | null | undefined,
): ExerciseSolutionEntry[] {
  const isRtl = locale?.toLowerCase().startsWith('he') ?? false
  const entries: ExerciseSolutionEntry[] = []

  exercises.forEach((exercise, exerciseIdx) => {
    const blocks = getBlocks(exercise)
    const exerciseSolutions: ExerciseSolutionEntry['solutions'] = []

    for (const block of blocks) {
      if (!QUESTION_BLOCK_TYPES.has(block.type)) continue
      const q = block as QuestionBlock
      const sol =
        (q as { fullSolution?: InlineRichText }).fullSolution ??
        (q as { solution?: InlineRichText }).solution
      if (!sol) continue
      exerciseSolutions.push({ blockId: q.id, subLabel: null, content: sol })
    }

    if (exerciseSolutions.length === 0) return

    const subLabeled = exerciseSolutions.map((s, i) => {
      if (exerciseSolutions.length === 1) return { ...s, subLabel: null }
      const subLabel = isRtl
        ? `${HEBREW_LETTERS[i] || String(i + 1)}.`
        : `${String.fromCharCode(97 + i)}.` // a., b., c., …
      return { ...s, subLabel }
    })

    entries.push({
      exerciseId: exercise.id,
      exerciseLabel: `${exerciseIdx + 1}.`,
      exerciseTitle: exercise.title,
      solutions: subLabeled,
    })
  })

  return entries
}

/** Renders the collected solutions section */
function SolutionsSection({
  entries,
  dir,
}: {
  entries: ExerciseSolutionEntry[]
  dir: 'ltr' | 'rtl'
}) {
  const t = useTranslations()

  if (entries.length === 0) return null

  return (
    <section className="mt-section-md border-t border-border/60 pt-section-md">
      <h2 className="mb-6 text-heading-md font-bold text-foreground">{t('solutionsHeading')}</h2>
      <ol className="flex flex-col gap-content-gap-lg list-none ps-0" dir={dir}>
        {entries.map((entry) => (
          <li key={entry.exerciseId} className="flex flex-col gap-content-gap-xs">
            <span className="font-bold text-primary">{entry.exerciseLabel}</span>
            <div className="flex flex-col gap-content-gap-xs ps-4">
              {entry.solutions.map((sol) => {
                const block: RichTextBlock = {
                  id: `sol-${sol.blockId}`,
                  type: 'rich_text',
                  format: sol.content.format,
                  value: sol.content.value,
                  mediaIds: sol.content.mediaIds ?? [],
                }
                return (
                  <div key={sol.blockId} className="flex gap-content-gap-xs">
                    {sol.subLabel && (
                      <span className="font-semibold text-foreground/80 shrink-0">
                        {sol.subLabel}
                      </span>
                    )}
                    <div className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed flex-1">
                      <RichTextRenderer block={block} />
                    </div>
                  </div>
                )
              })}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function BlocksDocumentLessonView({
  lessonTitle,
  backUrl,
  exercises,
  mediaMap,
  headerSlot,
  chatContent,
}: BlocksDocumentLessonViewProps) {
  const locale = useLocale()
  const dir: 'ltr' | 'rtl' = locale?.toLowerCase().startsWith('he') ? 'rtl' : 'ltr'

  const renderable = exercises
    .map((exercise) => ({ exercise, blocks: getBlocks(exercise) }))
    .filter((entry) => entry.blocks.length > 0)

  const solutionEntries = getSolutionsByExercise(exercises, locale)

  return (
    <ExerciseWorkspace
      exerciseTitle={lessonTitle}
      backUrl={backUrl}
      primaryContent={
        <div className="flex h-full flex-col">
          {headerSlot}
          <div className="flex-1 overflow-auto max-w-full bg-muted py-section-md px-4 print:bg-background print:overflow-visible print:p-0">
            <div className="mx-auto max-w-[794px] rounded-xl border border-border bg-card shadow-elevation-1 overflow-hidden print:shadow-none print:border-0 print:rounded-none print:max-w-full">
              <div
                className="px-12 py-10 font-serif sm:px-16 sm:py-section-lg max-w-full overflow-hidden"
                dir={dir}
              >
                {lessonTitle && (
                  <h1
                    className={cn(
                      'mb-8 text-heading-xl font-bold text-foreground',
                      dir === 'rtl' ? 'text-right' : 'text-left',
                    )}
                  >
                    {lessonTitle}
                  </h1>
                )}
                <div className="flex flex-col gap-12">
                  {renderable.map(({ exercise, blocks }) => (
                    <section key={exercise.id} className="flex flex-col gap-content-gap">
                      {exercise.title && (
                        <h2 className="text-heading-md font-bold text-foreground">
                          {exercise.title}
                        </h2>
                      )}
                      <ExerciseWorksheet
                        blocks={blocks}
                        mediaMap={mediaMap}
                        hideLatexBlocks={false}
                      />
                    </section>
                  ))}
                </div>

                {/* Solutions section — rendered AFTER all exercises */}
                <SolutionsSection entries={solutionEntries} dir={dir} />
              </div>
            </div>
          </div>
        </div>
      }
      chatContent={chatContent}
    />
  )
}
