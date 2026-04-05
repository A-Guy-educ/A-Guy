'use client'

import type { Exercise, Media as MediaType } from '@/payload-types'
import type { ResolvedLessonBlock } from '@/server/repos/queries/lesson-blocks'
import { Button } from '@/ui/web/components/button'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  Loader2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'
import { Progress } from '@/ui/web/components/progress'
import { useLessonPager } from './useLessonPager'
import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { ChatInterface } from '@/ui/web/chat'
import { Media as MediaComponent } from '@/ui/web/media'
import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/infra/utils/ui'
import { Confetti } from '@/ui/web/components/confetti'

const pageTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2 },
}

interface LessonPagerProps {
  blocks: ResolvedLessonBlock[]
  lessonTitle: string
  backUrl: string
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  lessonId: string
  mediaMap?: Record<string, MediaType>
  /** Pre-rendered content page bodies (keyed by content page ID) */
  contentPageBodies?: Record<string, React.ReactNode>
  /** PDF/media files attached to the lesson (contentFiles) */
  validFiles?: MediaType[]
  /** Lesson ID for chat context (defaults to lessonId) */
  chatLessonId?: string
  /** Whether the lesson has context text (controls chat visibility) */
  hasLessonContext?: boolean
  /** Whether the lesson has exercises (controls chat visibility) */
  hasExercises?: boolean
  /** Formula sheet data (passed to ChatInterface) */
  formulaSheet?: import('@/payload-types').FormulaSheet | null
}

export function LessonPager({
  blocks,
  lessonTitle,
  backUrl,
  courseSlug,
  chapterSlug,
  lessonSlug,
  lessonId,
  mediaMap,
  contentPageBodies,
  validFiles,
  chatLessonId,
  hasLessonContext,
  hasExercises,
  formulaSheet,
}: LessonPagerProps) {
  const t = useTranslations('courses')
  const {
    pageState,
    progressPercent,
    isNavigating,
    canGoNext,
    canGoPrev,
    handleNext,
    handlePrev,
    handleStart,
    getCurrentBlockOrdinal,
    totalBlocks,
  } = useLessonPager({
    blocks,
    courseSlug,
    chapterSlug,
    lessonSlug,
    hasPdfFiles: (validFiles?.length ?? 0) > 0,
  })

  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (pageState.type === 'outro') {
      setShowConfetti(true)
    }
  }, [pageState.type])

  // Swipe gesture state
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    if (isLeftSwipe && canGoNext) handleNext()
    if (isRightSwipe && canGoPrev) handlePrev()
  }

  // Focus management ref
  const contentRef = useRef<HTMLDivElement>(null)

  // Focus content area on page change
  useEffect(() => {
    if (pageState.type === 'block' && contentRef.current) {
      contentRef.current.focus()
    }
  }, [pageState.type, pageState.blockIndex])

  const currentBlock =
    pageState.type === 'block' && pageState.blockIndex !== undefined
      ? blocks[pageState.blockIndex]
      : null

  const exerciseCount = blocks.filter((b) => b.type === 'exercise').length
  const contentPageCount = blocks.filter((b) => b.type === 'contentPage').length

  // Render exercise block in workspace layout
  if (pageState.type === 'block' && currentBlock?.type === 'exercise') {
    const exercise = currentBlock.data as Exercise
    const ordinal = getCurrentBlockOrdinal()

    return (
      <ExerciseWorkspace
        exerciseTitle={exercise.title ?? ''}
        backUrl={backUrl}
        primaryContent={
          <div className="h-full flex flex-col">
            {/* Top progress line */}
            <Progress value={progressPercent} className="h-0.5 rounded-none" />

            <div
              ref={contentRef}
              tabIndex={-1}
              className="flex-1 overflow-y-auto min-h-0 pb-4 outline-none"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div className="w-full p-card-padding-sm md:p-card-padding space-y-4">
                {/* Breadcrumb step indicator */}
                <div className="flex items-center gap-content-gap-xs text-body-sm text-muted-foreground pt-3">
                  <span className="truncate max-w-[200px]">{lessonTitle}</span>
                  <ChevronRight className="w-3 h-3 shrink-0 rtl:rotate-180" />
                  <span className="text-foreground font-medium">
                    {ordinal !== null
                      ? `${t('exercise')} ${ordinal} ${t('of')} ${totalBlocks}`
                      : ''}
                  </span>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={pageState.blockIndex} {...pageTransition} className="space-y-4">
                    <div className="bg-card rounded-2xl border border-border/60 shadow-elevation-1 overflow-hidden">
                      <div className="p-5 md:p-card-padding">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Layers className="w-4 h-4 text-primary" />
                          </div>
                          <h2 className="text-body-lg font-medium text-foreground">
                            {exercise.title}
                          </h2>
                        </div>
                      </div>
                    </div>
                    <div className="bg-card rounded-2xl p-5 md:p-card-padding border border-border/60 shadow-elevation-1">
                      <ExerciseRenderer
                        content={exercise.content as unknown as ExerciseContentData}
                        mode="student"
                        showCheckAnswer={true}
                        mediaMap={mediaMap}
                        lessonId={lessonId}
                        exerciseId={exercise.id}
                        showExerciseNumber={exercise.showQuestionNumbering ?? false}
                      />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Fixed bottom navigation bar */}
            <div className="sticky bottom-0 z-30 bg-card/80 backdrop-blur-xl border-t border-border/50 px-6 py-content-gap pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="max-w-3xl mx-auto flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={!canGoPrev || isNavigating}
                  aria-label="Previous page"
                  className={cn(
                    'text-body-sm gap-content-gap-xs min-h-[44px] cursor-pointer transition-all duration-normal',
                    !canGoPrev || isNavigating
                      ? 'text-muted-foreground/40'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                  {t('exercisesPagerPrev')}
                </Button>
                <div className="flex flex-col items-center">
                  <span className="text-body-xs text-muted-foreground">
                    {ordinal !== null ? `${ordinal} / ${totalBlocks}` : ''}
                  </span>
                </div>
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext || isNavigating}
                  aria-label="Next page"
                  className="px-6 py-2 min-h-[44px] rounded-xl text-body-sm cursor-pointer gap-content-gap-xs"
                >
                  {isNavigating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {t('exercisesPagerNext')}
                  <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                </Button>
              </div>
            </div>
          </div>
        }
        chatContent={
          hasLessonContext || hasExercises ? (
            <ChatInterface
              lessonId={lessonId}
              exerciseId={exercise.id}
              currentExercise={{
                id: exercise.id,
                title: exercise.title ?? '',
                content: {
                  blocks: (exercise.content as unknown as ExerciseContentData).blocks.map(
                    (block) => {
                      const { id, type, ...rest } = block
                      return { id, type, ...rest }
                    },
                  ),
                },
              }}
              mediaMap={
                mediaMap as Record<
                  string,
                  {
                    id: string
                    url?: string | null
                    filename?: string
                    mimeType?: string
                    altText?: string
                  }
                >
              }
              translationNamespace="courses"
              showMathTools={true}
              formulaSheet={formulaSheet}
            />
          ) : null
        }
      />
    )
  }

  // Render content page block
  if (pageState.type === 'block' && currentBlock?.type === 'contentPage') {
    const contentPage = currentBlock.data
    const bodyRendered = contentPageBodies?.[contentPage.id]
    const ordinal = getCurrentBlockOrdinal()

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Top progress line */}
        <Progress value={progressPercent} className="h-0.5 rounded-none" />

        <main
          ref={contentRef}
          tabIndex={-1}
          className="flex-1 overflow-y-auto pb-4 outline-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="container mx-auto px-4 sm:px-6 py-section-md md:py-section-lg max-w-3xl">
            <AnimatePresence mode="wait">
              <motion.div key={pageState.blockIndex} {...pageTransition} className="space-y-8">
                {/* Breadcrumb step indicator */}
                <div className="flex items-center gap-content-gap-xs text-body-sm text-muted-foreground">
                  <span className="truncate max-w-[200px]">{lessonTitle}</span>
                  <ChevronRight className="w-3 h-3 shrink-0 rtl:rotate-180" />
                  <span className="text-foreground font-medium">
                    {ordinal !== null ? `${ordinal} / ${totalBlocks}` : ''}
                  </span>
                </div>

                <header className="text-center">
                  <span className="inline-block px-4 py-1.5 bg-muted text-muted-foreground rounded-full text-label tracking-[0.2em] uppercase mb-5 border border-border/40">
                    <FileText className="w-3 h-3 inline-block me-1" />
                    {ordinal} / {totalBlocks}
                  </span>
                  <h1 className="text-display-md md:text-display-lg font-medium leading-tight text-foreground mb-3">
                    {contentPage.title}
                  </h1>
                  <div className="w-20 h-1 bg-primary mx-auto rounded-full" />
                </header>

                <div className="bg-card rounded-3xl p-card-padding-lg md:p-10 border border-border/60 shadow-card-hover shadow-muted/50">
                  {bodyRendered ? (
                    <div className="prose prose-lg max-w-none dark:prose-invert leading-relaxed">
                      {bodyRendered}
                    </div>
                  ) : (
                    <div className="text-center py-section-md">
                      <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                        <FileText className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-body-sm font-medium text-muted-foreground">No content</p>
                      <p className="text-body-xs text-muted-foreground/60 mt-1">
                        This page has no content yet
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Fixed bottom navigation bar */}
        <div className="sticky bottom-0 z-30 bg-card/80 backdrop-blur-xl border-t border-border/50 px-6 py-content-gap pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={!canGoPrev || isNavigating}
              aria-label="Previous page"
              className={cn(
                'text-body-sm gap-content-gap-xs min-h-[44px] cursor-pointer transition-all duration-normal',
                !canGoPrev || isNavigating
                  ? 'text-muted-foreground/40'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              {t('exercisesPagerPrev')}
            </Button>
            <span className="text-body-xs text-muted-foreground">
              {ordinal !== null ? `${ordinal} / ${totalBlocks}` : ''}
            </span>
            <Button
              onClick={handleNext}
              disabled={!canGoNext || isNavigating}
              aria-label="Next page"
              className="px-6 py-2 min-h-[44px] rounded-xl text-body-sm cursor-pointer gap-content-gap-xs"
            >
              {isNavigating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t('exercisesPagerNext')}
              <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Render PDF viewer page
  if (pageState.type === 'pdf' && validFiles && validFiles.length > 0) {
    return (
      <ExerciseWorkspace
        exerciseTitle={lessonTitle}
        backUrl={backUrl}
        primaryContent={
          <div className="h-full flex flex-col min-h-0">
            {/* Top progress line */}
            <Progress value={progressPercent} className="h-0.5 rounded-none" />

            <div className="flex-1 overflow-y-auto min-h-0 pb-4">
              <div className="w-full h-full flex flex-col min-h-0">
                {validFiles.map((file, index) => (
                  <div key={file.id} className="w-full flex-1 min-h-0">
                    {index > 0 && (
                      <div className="h-0.5 my-8 flex-shrink-0 bg-gradient-to-r from-transparent via-border to-transparent" />
                    )}
                    <div className="border rounded-lg overflow-hidden bg-card shadow-card h-full">
                      <MediaComponent
                        resource={file}
                        className="w-full h-full"
                        htmlElement={null}
                        lessonId={lessonId}
                        courseId={courseSlug}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fixed bottom navigation bar */}
            <div className="sticky bottom-0 z-30 bg-card/80 backdrop-blur-xl border-t border-border/50 px-6 py-content-gap pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="max-w-3xl mx-auto flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={!canGoPrev || isNavigating}
                  aria-label="Previous page"
                  className={cn(
                    'text-body-sm gap-content-gap-xs min-h-[44px] cursor-pointer transition-all duration-normal',
                    !canGoPrev || isNavigating
                      ? 'text-muted-foreground/40'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                  {t('exercisesPagerPrev')}
                </Button>
                <span className="text-body-xs text-muted-foreground">{t('exercise')}</span>
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext || isNavigating}
                  aria-label="Next page"
                  className="px-6 py-2 min-h-[44px] rounded-xl text-body-sm cursor-pointer gap-content-gap-xs"
                >
                  {isNavigating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {t('exercisesPagerNext')}
                  <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                </Button>
              </div>
            </div>
          </div>
        }
        chatContent={
          hasLessonContext || hasExercises ? (
            <ChatInterface
              lessonId={chatLessonId ?? lessonId}
              translationNamespace="courses"
              showMathTools={true}
              formulaSheet={formulaSheet}
            />
          ) : null
        }
      />
    )
  }

  // Intro and outro pages
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Confetti active={showConfetti} />
      <Progress value={progressPercent} className="h-0.5 rounded-none" />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 sm:px-6 py-section-md md:py-section-lg max-w-3xl">
          {pageState.type === 'intro' && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="space-y-8"
            >
              <header className="text-center">
                <span className="inline-block px-4 py-1.5 bg-muted text-muted-foreground rounded-full text-label tracking-[0.2em] uppercase mb-5 border border-border/40">
                  {t('exercisesPagerIntro')}
                </span>
                <h1 className="text-heading-xl md:text-display-sm font-bold leading-tight text-foreground mb-2">
                  {lessonTitle}
                </h1>
                <div className="w-12 h-0.5 bg-primary mx-auto rounded-full" />
              </header>

              <div className="bg-card rounded-2xl p-card-padding md:p-card-padding-lg border border-border/40 text-center max-w-lg mx-auto">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-5">
                  <BookOpen className="w-7 h-7 text-primary" />
                </div>

                <h2 className="text-heading-xl font-bold mb-2 text-foreground">
                  {t('exercisesPagerWelcome')}
                </h2>
                <p className="text-muted-foreground mb-6 text-body-md max-w-sm mx-auto">
                  {t('exercisesPagerIntroDescriptionPart1')} {totalBlocks}{' '}
                  {t('exercisesPagerIntroDescriptionPart2')}
                </p>

                {/* Lesson contents summary */}
                <div className="flex items-center justify-center gap-content-gap mb-6">
                  {exerciseCount > 0 && (
                    <div className="inline-flex items-center gap-content-gap-xs px-3 py-1.5 bg-muted rounded-lg text-body-sm">
                      <Layers className="w-4 h-4 text-primary" />
                      <span className="text-primary font-semibold">{exerciseCount}</span>
                      <span className="text-muted-foreground">{t('exercise')}</span>
                    </div>
                  )}
                  {contentPageCount > 0 && (
                    <div className="inline-flex items-center gap-content-gap-xs px-3 py-1.5 bg-muted rounded-lg text-body-sm">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-primary font-semibold">{contentPageCount}</span>
                      <span className="text-muted-foreground">{t('contentPages') ?? 'Pages'}</span>
                    </div>
                  )}
                </div>

                <Button onClick={handleStart} size="lg" className="px-10 rounded-xl cursor-pointer">
                  {t('exercisesPagerStart')}{' '}
                  <ChevronLeft className="w-5 h-5 ms-2 rtl:rotate-0 ltr:rotate-180" />
                </Button>
              </div>
            </motion.div>
          )}

          {pageState.type === 'outro' && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="space-y-8"
            >
              <header className="text-center relative">
                {/* Decorative background circles */}
                <div className="absolute inset-0 -top-10 flex items-center justify-center pointer-events-none overflow-hidden">
                  <div className="w-64 h-64 rounded-full bg-gradient-to-br from-secondary/10 to-primary/5 blur-3xl" />
                  <div className="absolute w-40 h-40 rounded-full bg-gradient-to-tr from-primary/10 to-secondary/5 blur-2xl -translate-x-20 translate-y-10" />
                </div>

                <span className="relative inline-block px-4 py-1.5 bg-secondary/10 text-secondary rounded-full text-label tracking-[0.2em] uppercase mb-5 border border-secondary/20">
                  {t('exercisesPagerCompleted')}
                </span>
                <h1 className="relative text-display-lg md:text-display-xl font-bold leading-tight text-foreground mb-3">
                  {t('exercisesPagerCompletedTitle')}
                </h1>
                <div className="w-20 h-1 bg-secondary mx-auto rounded-full" />
              </header>

              <div className="bg-card rounded-3xl p-card-padding-lg md:p-10 border border-border/60 shadow-card-hover shadow-muted/50 text-center relative overflow-hidden">
                {/* Decorative corner accents */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-secondary/5 to-transparent rounded-bl-full" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-primary/5 to-transparent rounded-tr-full" />

                <div className="relative">
                  <div className="w-24 h-24 bg-secondary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-card shadow-secondary/10 border border-secondary/20">
                    <Sparkles className="w-11 h-11 text-secondary" />
                  </div>

                  <h2 className="text-display-xl font-bold mb-4 text-foreground">
                    {t('exercisesPagerCompletedTitle')}
                  </h2>
                  <p className="text-muted-foreground mb-6 text-body-lg leading-relaxed max-w-2xl mx-auto">
                    {t('exercisesPagerCompletedDescription')}
                  </p>

                  {/* Summary stats */}
                  <div className="flex items-center justify-center gap-content-gap-lg mb-10">
                    {exerciseCount > 0 && (
                      <div className="inline-flex items-center gap-content-gap-xs px-4 py-2 bg-secondary/5 rounded-xl border border-secondary/10">
                        <Layers className="w-4 h-4 text-secondary" />
                        <span className="text-secondary font-medium">{exerciseCount}</span>
                        <span className="text-body-xs text-muted-foreground">{t('exercise')}</span>
                      </div>
                    )}
                    {contentPageCount > 0 && (
                      <div className="inline-flex items-center gap-content-gap-xs px-4 py-2 bg-secondary/5 rounded-xl border border-secondary/10">
                        <FileText className="w-4 h-4 text-secondary" />
                        <span className="text-secondary font-medium">{contentPageCount}</span>
                        <span className="text-body-xs text-muted-foreground">
                          {t('contentPages') ?? 'Pages'}
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    asChild
                    size="lg"
                    variant="secondary"
                    className="w-full py-section-sm rounded-2xl text-body-lg shadow-card shadow-secondary/20 hover:shadow-card-hover hover:shadow-secondary/30 transition-all duration-slow"
                  >
                    <SystemLink href={backUrl}>
                      <Sparkles className="w-5 h-5 me-2" />
                      {t('exercisesPagerComplete')}
                    </SystemLink>
                  </Button>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={isNavigating}
                  aria-label="Previous page"
                  className="text-muted-foreground text-body-sm min-h-[44px] hover:text-foreground transition-colors duration-slow gap-content-gap-xs cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                  {t('exercisesPagerPrev')}
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}
