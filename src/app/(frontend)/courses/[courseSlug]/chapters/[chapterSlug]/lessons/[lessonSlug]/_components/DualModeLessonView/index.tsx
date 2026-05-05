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
import { useLessonViewMode, type LessonMode } from './useLessonViewMode'

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
  /** Renderer modes enabled by the admin for this lesson. Defaults to all three. */
  visibleRenderers?: LessonMode[]
}

/**
 * Returns which tabs should be rendered, combining the admin toggle with the
 * data-presence guard for the Media tab.
 *
 * - Media: shown only when `hasMedia` AND 'media' is in `visibleRenderers`.
 * - PDF / Interactive: shown when their respective value is in `visibleRenderers`.
 * - When `visibleRenderers` is undefined, all three tabs are shown (backward
 *   compatible for lessons created before this feature existed).
 */
function getVisibleTabs(
  visibleRenderers: LessonMode[] | undefined,
  hasMedia: boolean,
): { media: boolean; pdf: boolean; interactive: boolean } {
  const all: LessonMode[] = ['media', 'pdf', 'interactive']
  const allowed = visibleRenderers ?? all
  return {
    media: hasMedia && allowed.includes('media'),
    pdf: allowed.includes('pdf'),
    interactive: allowed.includes('interactive'),
  }
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
    visibleRenderers,
  } = props

  const t = useTranslations('courses')
  const hasMedia = validFiles.length > 0
  const visibleTabs = getVisibleTabs(visibleRenderers, hasMedia)
  const [mode, select] = useLessonViewMode(lessonId, visibleRenderers)

  // Resolve the active tab, falling back when the stored mode is no longer allowed.
  const effectiveMode = (() => {
    if (!visibleTabs[mode]) {
      // Stored mode points to a tab the admin just disabled — pick the first available.
      if (visibleTabs.media) return 'media'
      if (visibleTabs.pdf) return 'pdf'
      return 'interactive'
    }
    return mode
  })()

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
      {visibleTabs.media && (
        <TabButton
          id={tabIds.mediaTab}
          controlsId={tabIds.mediaPanel}
          label={t('lessonViewModeMedia')}
          active={effectiveMode === 'media'}
          onClick={() => select('media')}
        />
      )}
      {visibleTabs.pdf && (
        <TabButton
          id={tabIds.pdfTab}
          controlsId={tabIds.pdfPanel}
          label={t('lessonViewModePdf')}
          active={effectiveMode === 'pdf'}
          onClick={() => select('pdf')}
        />
      )}
      {visibleTabs.interactive && (
        <TabButton
          id={tabIds.interactiveTab}
          controlsId={tabIds.interactivePanel}
          label={t('lessonViewModeInteractive')}
          active={effectiveMode === 'interactive'}
          onClick={() => select('interactive')}
        />
      )}
    </div>
  )

  if (effectiveMode === 'media') {
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

  if (effectiveMode === 'pdf') {
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
