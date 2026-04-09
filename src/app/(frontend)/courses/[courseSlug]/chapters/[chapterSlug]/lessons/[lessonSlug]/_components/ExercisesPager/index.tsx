'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Exercise, Media as MediaType } from '@/payload-types'
import { Button } from '@/ui/web/components/button'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'
import { Progress } from '@/ui/web/components/progress'
import { useExercisesPager } from './useExercisesPager'
import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { ChatInterface } from '@/ui/web/chat'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/infra/utils/ui'
import { Confetti } from '@/ui/web/components/confetti'

const pageTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2 },
}

interface ExercisesPagerProps {
  exercises: Exercise[]
  lessonTitle: string
  backUrl: string
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  lessonId: string
  mediaMap?: Record<string, MediaType>
  /** Whether the lesson has context text (controls chat visibility) */
  hasLessonContext?: boolean
  /** Whether the lesson has exercises (controls chat visibility) */
  hasExercises?: boolean
  /** Formula sheet data (passed to ChatInterface) */
  formulaSheet?: import('@/payload-types').FormulaSheet | null
}

export function ExercisesPager({
  exercises,
  lessonTitle,
  backUrl,
  courseSlug,
  chapterSlug,
  lessonSlug,
  lessonId,
  mediaMap,
  hasLessonContext,
  hasExercises,
  formulaSheet,
}: ExercisesPagerProps) {
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
    getExerciseOrdinal,
    totalExercises,
  } = useExercisesPager({ exercises, courseSlug, chapterSlug, lessonSlug, lessonId })

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
    if (pageState.type === 'exercise' && contentRef.current) {
      contentRef.current.focus()
    }
  }, [pageState.exerciseIndex, pageState.type])

  // Store per-exercise question results from ExerciseRenderer
  const exerciseResults = useRef<
    Record<string, { totalQuestions: number; checkedCount: number; correctCount: number }>
  >({})
  const trackedExercises = useRef(new Set<string>())
  const prevExerciseIndex = useRef<number | undefined>(undefined)
  const trackedLessonCompletion = useRef(false)

  // Track exercise when navigating away — only if student checked at least one answer
  useEffect(() => {
    if (
      prevExerciseIndex.current !== undefined &&
      prevExerciseIndex.current !== pageState.exerciseIndex
    ) {
      const prevExercise = exercises[prevExerciseIndex.current]
      if (prevExercise && !trackedExercises.current.has(prevExercise.id)) {
        const results = exerciseResults.current[prevExercise.id]
        const checkedCount = results?.checkedCount || 0

        // Only track if student actually attempted at least one question
        if (checkedCount > 0) {
          trackedExercises.current.add(prevExercise.id)
          const totalQuestions = results?.totalQuestions || 1
          const correctCount = results?.correctCount || 0
          const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
          fetch('/api/stats/track-activity', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventType: 'exercise_completed',
              exerciseId: prevExercise.id,
              exerciseTitle: prevExercise.title || '',
              lessonId,
              score,
              totalQuestions,
              correctCount,
            }),
          }).catch(() => {
            // fail silently
          })
        }
      }
    }
    prevExerciseIndex.current = pageState.exerciseIndex
  }, [pageState.exerciseIndex, exercises, lessonId])

  // Track lesson completion when reaching outro — only if student attempted exercises
  useEffect(() => {
    if (pageState.type === 'outro' && !trackedLessonCompletion.current) {
      // Only mark lesson complete if at least one exercise was actually attempted
      const hasAttemptedExercises = trackedExercises.current.size > 0
      if (hasAttemptedExercises) {
        trackedLessonCompletion.current = true
        fetch('/api/stats/track-activity', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'lesson_completed',
            lessonId,
            lessonTitle,
          }),
        }).catch(() => {
          // fail silently
        })
      }
    }
  }, [pageState.type, lessonId, lessonTitle])

  const exerciseOrdinal = getExerciseOrdinal()
  const currentExercise =
    typeof pageState.exerciseIndex === 'number' ? exercises[pageState.exerciseIndex] : null

  const handleExerciseResultsChange = useCallback(
    (results: { totalQuestions: number; checkedCount: number; correctCount: number }) => {
      if (currentExercise) {
        exerciseResults.current[currentExercise.id] = results
      }
    },
    [currentExercise],
  )

  if (pageState.type === 'exercise' && currentExercise) {
    return (
      <ExerciseWorkspace
        exerciseTitle={currentExercise.title ?? ''}
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
                <div className="flex items-center gap-2 text-body-sm text-muted-foreground pt-3">
                  <span className="truncate max-w-[200px]">{lessonTitle}</span>
                  <ChevronRight className="w-3 h-3 shrink-0 rtl:rotate-180" />
                  <span className="text-foreground font-medium">
                    {exerciseOrdinal !== null
                      ? `${t('exercise')} ${exerciseOrdinal} ${t('of')} ${totalExercises}`
                      : ''}
                  </span>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={currentExercise.id} {...pageTransition} className="space-y-4">
                    <div className="bg-card rounded-2xl border border-border/60 shadow-elevation-1 overflow-hidden">
                      <div className="p-5 md:p-card-padding">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Layers className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <h2 className="text-body-lg font-medium text-foreground">
                              {currentExercise.title}
                            </h2>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-card rounded-2xl p-5 md:p-card-padding border border-border/60 shadow-elevation-1">
                      <ExerciseRenderer
                        key={currentExercise.id}
                        content={currentExercise.content as unknown as ExerciseContentData}
                        mode="student"
                        showCheckAnswer={true}
                        mediaMap={mediaMap}
                        lessonId={lessonId}
                        exerciseId={currentExercise.id}
                        showExerciseNumber={currentExercise.showQuestionNumbering ?? false}
                        onResultsChange={handleExerciseResultsChange}
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
                    'text-body-sm gap-2 min-h-[44px] cursor-pointer transition-all duration-normal',
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
                    {exerciseOrdinal !== null ? `${exerciseOrdinal} / ${totalExercises}` : ''}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 hidden sm:block">← →</span>
                </div>
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext || isNavigating}
                  aria-label="Next page"
                  className="px-6 py-2 min-h-[44px] rounded-xl text-body-sm cursor-pointer gap-2"
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
              exerciseId={currentExercise.id}
              currentExercise={{
                id: currentExercise.id,
                title: currentExercise.title ?? '',
                content: {
                  blocks: (currentExercise.content as unknown as ExerciseContentData).blocks.map(
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
                <h1 className="text-display-lg md:text-display-xl font-bold leading-tight text-foreground mb-3">
                  {lessonTitle}
                </h1>
                <div className="w-20 h-1 bg-primary mx-auto rounded-full" />
              </header>

              <div className="bg-card rounded-3xl p-card-padding-lg md:p-10 border border-border/60 shadow-card-hover shadow-muted/50 text-center">
                <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-card shadow-primary/10 border border-primary/20">
                  <BookOpen className="w-11 h-11 text-primary" />
                </div>

                <h2 className="text-display-xl font-medium mb-4 text-foreground">
                  {t('exercisesPagerWelcome')}
                </h2>
                <p className="text-muted-foreground mb-10 text-body-lg leading-relaxed max-w-2xl mx-auto">
                  {t('exercisesPagerIntroDescriptionPart1')} {totalExercises}{' '}
                  {t('exercisesPagerIntroDescriptionPart2')}
                </p>

                <div className="inline-flex items-center gap-3 px-5 py-3 bg-muted rounded-2xl border border-border/60 mb-10">
                  <Layers className="w-5 h-5 text-primary" />
                  <span className="text-primary text-heading-xl font-medium">{totalExercises}</span>
                  <span className="text-label text-muted-foreground uppercase tracking-wider">
                    {t('exercise')}
                  </span>
                </div>

                <Button
                  onClick={handleStart}
                  size="lg"
                  className="w-full py-section-sm rounded-2xl text-body-lg shadow-card shadow-primary/20 hover:shadow-card-hover hover:shadow-primary/30 transition-all duration-slow cursor-pointer"
                >
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
                  <div className="flex items-center justify-center gap-content-gap mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/5 rounded-xl border border-secondary/10">
                      <Layers className="w-4 h-4 text-secondary" />
                      <span className="text-secondary font-medium">{totalExercises}</span>
                      <span className="text-body-xs text-muted-foreground">{t('exercise')}</span>
                    </div>
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
                  className="text-muted-foreground text-body-sm min-h-[44px] hover:text-foreground transition-colors duration-slow gap-2 cursor-pointer"
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
