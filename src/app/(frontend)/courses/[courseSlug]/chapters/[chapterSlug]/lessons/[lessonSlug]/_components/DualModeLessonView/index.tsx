/**
 * @fileType component
 * @domain lessons
 * @pattern dual-view
 * @ai-summary Two-tab lesson view that lets the student toggle between a paper-style
 *             "PDF" document built from the same exercise blocks the Interactive tab
 *             renders, and the interactive exercise pager. Tab choice is persisted
 *             per lesson in localStorage. Both tabs read from `exercise.content.blocks`
 *             so admin edits flow to both.
 */

'use client'

import React from 'react'
import type { Exercise, FormulaSheet, Media as MediaType } from '@/payload-types'
import type { ResolvedLessonBlock } from '@/server/repos/queries/lesson-blocks'
import { ChatInterface } from '@/ui/web/chat'
import { useTranslations } from '@/ui/web/providers/I18n'
import { BlocksDocumentLessonView } from '../BlocksDocumentLessonView'
import { ExercisesPager } from '../ExercisesPager'
import { LessonPager } from '../LessonPager'
import { TabButton } from './TabButton'
import { useLessonViewMode } from './useLessonViewMode'

/** Which interactive pager to render on the Interactive tab. */
type InteractiveSource =
  | {
      kind: 'blocks'
      blocks: ResolvedLessonBlock[]
      contentPageBodies?: Record<string, React.ReactNode>
      validFiles?: MediaType[]
    }
  | { kind: 'exercises'; exercises: Exercise[] }

interface DualModeLessonViewProps {
  lessonId: string
  lessonTitle: string
  backUrl: string
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  /** Grade bucket for progress storage — must be the lesson's course label, not the user's profile grade. */
  gradeLevel: string
  /** Exercises whose blocks feed both the PDF document and the Interactive pager. */
  exercises: Exercise[]
  interactive: InteractiveSource
  mediaMap?: Record<string, MediaType>
  chatLessonId?: string
  showChat?: boolean
  formulaSheet?: FormulaSheet | null
}

export function DualModeLessonView(props: DualModeLessonViewProps) {
  const {
    lessonId,
    lessonTitle,
    backUrl,
    courseSlug,
    chapterSlug,
    lessonSlug,
    gradeLevel,
    exercises,
    interactive,
    mediaMap,
    chatLessonId,
    showChat,
    formulaSheet,
  } = props

  const t = useTranslations('courses')
  const [mode, select] = useLessonViewMode(lessonId)

  // Stable ids per lesson so tabs and panels can be wired with aria-controls /
  // aria-labelledby without risk of collision when multiple DualModeLessonView
  // instances coexist on a page.
  const tabIds = {
    pdfTab: `lesson-${lessonId}-tab-pdf`,
    interactiveTab: `lesson-${lessonId}-tab-interactive`,
    pdfPanel: `lesson-${lessonId}-panel-pdf`,
    interactivePanel: `lesson-${lessonId}-panel-interactive`,
  }

  const tabBar = (
    <div
      role="tablist"
      aria-label={t('lessonViewMode')}
      className="flex items-center gap-1 border-b border-border bg-card px-4 py-2 print:hidden"
    >
      <TabButton
        id={tabIds.pdfTab}
        controlsId={tabIds.pdfPanel}
        label={t('lessonViewModePdf')}
        active={mode === 'pdf'}
        onClick={() => select('pdf')}
      />
      <TabButton
        id={tabIds.interactiveTab}
        controlsId={tabIds.interactivePanel}
        label={t('lessonViewModeInteractive')}
        active={mode === 'interactive'}
        onClick={() => select('interactive')}
      />
    </div>
  )

  if (mode === 'pdf') {
    return (
      <section role="tabpanel" id={tabIds.pdfPanel} aria-labelledby={tabIds.pdfTab}>
        <BlocksDocumentLessonView
          lessonTitle={lessonTitle}
          backUrl={backUrl}
          exercises={exercises}
          mediaMap={mediaMap}
          headerSlot={tabBar}
          chatContent={
            showChat ? (
              <ChatInterface
                lessonId={chatLessonId ?? lessonId}
                translationNamespace="courses"
                showMathTools={true}
                formulaSheet={formulaSheet}
              />
            ) : null
          }
        />
      </section>
    )
  }

  if (interactive.kind === 'blocks') {
    return (
      <section role="tabpanel" id={tabIds.interactivePanel} aria-labelledby={tabIds.interactiveTab}>
        <LessonPager
          blocks={interactive.blocks}
          lessonTitle={lessonTitle}
          backUrl={backUrl}
          courseSlug={courseSlug}
          chapterSlug={chapterSlug}
          lessonSlug={lessonSlug}
          lessonId={lessonId}
          mediaMap={mediaMap}
          contentPageBodies={interactive.contentPageBodies}
          validFiles={interactive.validFiles}
          chatLessonId={chatLessonId}
          showChat={showChat}
          formulaSheet={formulaSheet}
          headerSlot={tabBar}
          hideLatexBlocks
        />
      </section>
    )
  }

  return (
    <section role="tabpanel" id={tabIds.interactivePanel} aria-labelledby={tabIds.interactiveTab}>
      <ExercisesPager
        exercises={interactive.exercises}
        lessonTitle={lessonTitle}
        backUrl={backUrl}
        courseSlug={courseSlug}
        chapterSlug={chapterSlug}
        lessonSlug={lessonSlug}
        lessonId={lessonId}
        gradeLevel={gradeLevel}
        mediaMap={mediaMap}
        showChat={showChat}
        formulaSheet={formulaSheet}
        headerSlot={tabBar}
        hideLatexBlocks
      />
    </section>
  )
}
