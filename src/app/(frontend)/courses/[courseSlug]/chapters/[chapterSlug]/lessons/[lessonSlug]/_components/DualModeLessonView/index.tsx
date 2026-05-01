/**
 * @fileType component
 * @domain lessons
 * @pattern dual-view
 * @ai-summary Tab-based lesson view supporting up to three tabs: Media (attached
 *             files), PDF (worksheet from exercise blocks), and Interactive (exercise
 *             pager with answer UI). Media tab only appears when the lesson has
 *             attached files. Tab choice is persisted per lesson in localStorage.
 *             Both PDF and Interactive tabs read from `exercise.content.blocks` so
 *             admin edits flow to both.
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
import { MediaTabContent } from '../MediaTabContent'
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
  /** Attached media files — when present, a "Media" tab is shown as the first tab. */
  validFiles?: MediaType[]
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
    validFiles = [],
    mediaMap,
    chatLessonId,
    showChat,
    formulaSheet,
  } = props

  const t = useTranslations('courses')
  const hasMedia = validFiles.length > 0
  const [mode, select] = useLessonViewMode(lessonId)

  // If stored mode is 'media' but this lesson has no files, fall back to 'pdf'.
  const activeMode = mode === 'media' && !hasMedia ? 'pdf' : mode

  const tabIds = {
    mediaTab: `lesson-${lessonId}-tab-media`,
    pdfTab: `lesson-${lessonId}-tab-pdf`,
    interactiveTab: `lesson-${lessonId}-tab-interactive`,
    mediaPanel: `lesson-${lessonId}-panel-media`,
    pdfPanel: `lesson-${lessonId}-panel-pdf`,
    interactivePanel: `lesson-${lessonId}-panel-interactive`,
  }

  const tabBar = (
    <div
      role="tablist"
      aria-label={t('lessonViewMode')}
      className="flex items-center gap-1 border-b border-border bg-card px-4 py-2 print:hidden"
    >
      {hasMedia && (
        <TabButton
          id={tabIds.mediaTab}
          controlsId={tabIds.mediaPanel}
          label={t('lessonViewModeMedia')}
          active={activeMode === 'media'}
          onClick={() => select('media')}
        />
      )}
      <TabButton
        id={tabIds.pdfTab}
        controlsId={tabIds.pdfPanel}
        label={t('lessonViewModePdf')}
        active={activeMode === 'pdf'}
        onClick={() => select('pdf')}
      />
      <TabButton
        id={tabIds.interactiveTab}
        controlsId={tabIds.interactivePanel}
        label={t('lessonViewModeInteractive')}
        active={activeMode === 'interactive'}
        onClick={() => select('interactive')}
      />
    </div>
  )

  if (activeMode === 'media' && hasMedia) {
    return (
      <section role="tabpanel" id={tabIds.mediaPanel} aria-labelledby={tabIds.mediaTab}>
        <MediaTabContent
          lessonTitle={lessonTitle}
          backUrl={backUrl}
          lessonId={lessonId}
          validFiles={validFiles}
          courseSlug={courseSlug}
          headerSlot={tabBar}
          showChat={showChat}
          chatLessonId={chatLessonId}
          formulaSheet={formulaSheet}
        />
      </section>
    )
  }

  if (activeMode === 'pdf') {
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
          /* Don't pass validFiles here — when running inside the multi-tab
             view, the dedicated Media tab handles attached files. Forwarding
             them would also insert a PDF page into LessonPager's internal
             flow, making the Interactive tab open on the PDF. */
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
