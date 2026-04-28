/**
 * BlocksDocumentLessonView
 *
 * Renders a lesson's exercises as a single paper-style document (the "PDF
 * tab"). Each exercise's structured blocks (`exercise.content.blocks`) are
 * laid out worksheet-style via ExerciseWorksheet — same source of truth as
 * the Interactive tab, just non-interactive and styled as a printed page.
 */

'use client'

import React from 'react'
import { ExerciseWorksheet } from '@/ui/web/exerciserenderer/ExerciseWorksheet'
import { useLocale } from '@/ui/web/providers/I18n'
import type { Exercise, Media as MediaType } from '@/payload-types'
import { ExerciseWorkspace } from '../../exercises/[exerciseSlug]/_components/ExerciseWorkspace'

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

  return (
    <ExerciseWorkspace
      exerciseTitle={lessonTitle}
      backUrl={backUrl}
      primaryContent={
        <div className="flex h-full flex-col">
          {headerSlot}
          <div className="flex-1 overflow-auto bg-gradient-to-b from-muted via-muted to-border/40 py-section-md px-4 print:bg-background print:overflow-visible print:p-0">
            <article
              dir={dir}
              className="mx-auto max-w-[794px] overflow-hidden rounded-md border border-border bg-card shadow-modal print:shadow-none print:border-0 print:rounded-none print:max-w-full"
            >
              <header className="flex items-center justify-between border-b border-border/60 bg-card px-12 py-3 print:hidden">
                <span className="truncate text-body-sm font-medium text-muted-foreground">
                  {lessonTitle}
                </span>
                <span
                  aria-hidden
                  className="font-mono text-body-xs tracking-[0.4em] text-muted-foreground/50"
                >
                  —
                </span>
              </header>

              <div className="bg-background px-12 py-10 font-serif sm:px-16 sm:py-section-lg">
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
              </div>

              <footer className="flex items-center justify-between border-t border-border/60 bg-card px-12 py-2 text-body-xs text-muted-foreground/70 print:hidden">
                <span className="truncate">{lessonTitle}</span>
                <span className="font-mono tracking-[0.3em]">· · ·</span>
              </footer>
            </article>
          </div>
        </div>
      }
      chatContent={chatContent}
    />
  )
}
