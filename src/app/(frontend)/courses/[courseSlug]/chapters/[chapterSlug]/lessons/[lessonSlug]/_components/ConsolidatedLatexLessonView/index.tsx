/**
 * @fileType component
 * @domain lessons
 * @pattern view
 * @ai-summary Renders every LaTeX block from a practice/exam lesson's exercises as a single
 *             PDF-like document. The page floats in a darker "reading room" gutter with a
 *             subtle header/footer chrome, evoking a PDF viewer.
 */

'use client'

import React from 'react'
import { LatexDocumentViewer } from '@/ui/web/shared/LatexDocumentViewer'
import { ExerciseWorkspace } from '../../exercises/[exerciseSlug]/_components/ExerciseWorkspace'

interface ConsolidatedLatexLessonViewProps {
  lessonTitle: string
  backUrl: string
  consolidatedLatex: string
  chatContent?: React.ReactNode
  /** Optional element rendered at the top of the primary pane (e.g. a tab bar). */
  headerSlot?: React.ReactNode
}

export function ConsolidatedLatexLessonView({
  lessonTitle,
  backUrl,
  consolidatedLatex,
  chatContent,
  headerSlot,
}: ConsolidatedLatexLessonViewProps) {
  return (
    <ExerciseWorkspace
      exerciseTitle={lessonTitle}
      backUrl={backUrl}
      primaryContent={
        <div className="flex h-full flex-col">
          {headerSlot}
          <div className="flex-1 overflow-auto bg-gradient-to-b from-muted via-muted to-border/40 py-section-md px-4 print:bg-background print:overflow-visible print:p-0">
            <article className="mx-auto max-w-[794px] overflow-hidden rounded-md border border-border bg-card shadow-modal print:shadow-none print:border-0 print:rounded-none print:max-w-full">
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
              <LatexDocumentViewer
                latex={consolidatedLatex}
                title={lessonTitle}
                showPrintButton={false}
                className="max-w-full rounded-none border-0 shadow-none overflow-visible"
              />
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
