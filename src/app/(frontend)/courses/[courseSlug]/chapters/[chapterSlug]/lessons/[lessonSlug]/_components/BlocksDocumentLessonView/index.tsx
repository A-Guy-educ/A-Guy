/**
 * BlocksDocumentLessonView
 *
 * Renders a lesson's exercises as a single paper-style document (the "PDF
 * tab"). Each exercise's structured blocks (`exercise.content.blocks`) are
 * laid out worksheet-style via ExerciseWorksheet — same source of truth as
 * the Interactive tab, just non-interactive and styled as a printed page.
 *
 * Solutions (fullSolution/solution) from question blocks are collected into
 * a single "Solutions" section rendered AFTER all exercises, before the
 * copyright footer.
 *
 * The document uses a <table> structure so the <tfoot> copyright footer
 * repeats on every printed page via CSS @page rules.
 */

'use client'

import React from 'react'
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
          <div className="flex-1 overflow-auto bg-gradient-to-b from-muted via-muted to-border/40 py-section-md px-4 print:bg-background print:overflow-visible print:p-0">
            {/* Use a table so <tfoot> repeats on every printed page */}
            <table
              className="mx-auto max-w-[794px] w-full border-collapse overflow-hidden rounded-md border border-border bg-card shadow-modal print:shadow-none print:border-0 print:rounded-none print:max-w-full"
              style={{ page: 'lesson-page' }}
            >
              {/* Screen-only header */}
              <thead>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={1}
                    className="border-b border-border/60 bg-card px-12 py-3 text-left print:hidden"
                  >
                    <span className="truncate text-body-sm font-medium text-muted-foreground">
                      {lessonTitle}
                    </span>
                  </th>
                </tr>
              </thead>

              {/* Document body — lesson title, exercises, solutions */}
              <tbody>
                <tr>
                  <td className="bg-background px-12 py-10 font-serif sm:px-16 sm:py-section-lg">
                    {lessonTitle && (
                      <h1 className="mb-8 text-center text-heading-xl font-bold text-foreground">
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
                          <ExerciseWorksheet blocks={blocks} mediaMap={mediaMap} />
                        </section>
                      ))}
                    </div>

                    {/* Solutions section — rendered AFTER all exercises, BEFORE footer */}
                    <SolutionsSection entries={solutionEntries} dir={dir} />
                  </td>
                </tr>
              </tbody>

              {/* Single <tfoot> — screen footer row hidden in print, print copyright row hidden on screen */}
              <tfoot>
                {/* Screen-only footer row */}
                <tr className="print:hidden">
                  <td className="flex items-center justify-between border-t border-border/60 bg-card px-12 py-2 text-body-xs text-muted-foreground/70">
                    <span className="truncate">{lessonTitle}</span>
                    <span className="font-mono tracking-[0.3em]">· · ·</span>
                  </td>
                </tr>
                {/* Print-only copyright row: repeats on every printed page via @page rules */}
                <tr className="hidden print:table-row">
                  <td className="border-t border-border/60 px-12 py-2 text-center text-body-xs text-muted-foreground/70">
                    כל הזכויות שמורות לגיא קורן, אין להעתיק, לצלם, לפרסם את המסמכים או חלקם ללא
                    אישור בכתב מגיא קורן
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      }
      chatContent={chatContent}
    />
  )
}
