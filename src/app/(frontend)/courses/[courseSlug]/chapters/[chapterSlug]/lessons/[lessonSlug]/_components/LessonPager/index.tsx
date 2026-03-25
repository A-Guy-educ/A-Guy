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
} from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'
import { Progress } from '@/ui/web/components/progress'
import { useLessonPager } from './useLessonPager'
import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { ChatInterface } from '@/ui/web/chat'
import { Media as MediaComponent } from '@/ui/web/media'
import type React from 'react'

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

  const currentBlock =
    pageState.type === 'block' && pageState.blockIndex !== undefined
      ? blocks[pageState.blockIndex]
      : null

  const exerciseCount = blocks.filter((b) => b.type === 'exercise').length

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
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="w-full p-card-padding-sm md:p-card-padding space-y-4">
                <div className="bg-card rounded-2xl border border-border/60 shadow-elevation-1 overflow-hidden mt-4">
                  <Progress value={progressPercent} className="h-1.5 rounded-none" />
                  <div className="p-5 md:p-card-padding">
                    <p className="text-start text-body-md font-semibold text-slate-900 dark:text-slate-100 mb-3">
                      {ordinal !== null
                        ? `${t('exercise')} ${ordinal} ${t('of')} ${totalBlocks}`
                        : ''}
                    </p>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Layers className="w-4 h-4 text-primary" />
                      </div>
                      <h2 className="text-body-lg font-medium text-foreground">{exercise.title}</h2>
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
              </div>
            </div>
            <div className="shrink-0 border-t border-border bg-card px-4 py-3">
              <div className="flex justify-between items-center">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={!canGoPrev || isNavigating}
                  className="text-muted-foreground text-body-sm hover:text-foreground gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />{' '}
                  {t('exercisesPagerPrev')}
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext || isNavigating}
                  className="px-6 py-2 rounded-xl text-body-sm cursor-pointer"
                >
                  {isNavigating ? (
                    <>
                      <Loader2 className="w-4 h-4 me-2 animate-spin" />
                      {t('exercisesPagerNext')}
                    </>
                  ) : (
                    t('exercisesPagerNext')
                  )}
                </Button>
              </div>
            </div>
          </div>
        }
        chatContent={
          <ChatInterface
            lessonId={lessonId}
            exerciseId={exercise.id}
            currentExercise={{
              id: exercise.id,
              title: exercise.title ?? '',
              content: {
                blocks: (exercise.content as unknown as ExerciseContentData).blocks.map((block) => {
                  const { id, type, ...rest } = block
                  return { id, type, ...rest }
                }),
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
        }
      />
    )
  }

  // Render content page block
  if (pageState.type === 'block' && currentBlock?.type === 'contentPage') {
    const contentPage = currentBlock.data
    const bodyRendered = contentPageBodies?.[contentPage.id]

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Progress value={progressPercent} className="h-1.5 rounded-none" />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 sm:px-6 py-section-md md:py-section-lg max-w-7xl">
            <div className="space-y-8">
              <header className="text-center">
                <span className="inline-block px-4 py-1.5 bg-muted text-muted-foreground rounded-full text-[10px] tracking-[0.2em] uppercase mb-5 border border-border/40">
                  <FileText className="w-3 h-3 inline-block me-1" />
                  {getCurrentBlockOrdinal()} / {totalBlocks}
                </span>
                <h1 className="text-display-md md:text-[42px] font-medium leading-tight text-foreground mb-3">
                  {contentPage.title}
                </h1>
                <div className="w-20 h-1 bg-primary mx-auto rounded-full" />
              </header>

              <div className="bg-card rounded-3xl p-card-padding-lg md:p-10 border border-border/60 shadow-card-hover shadow-muted/50">
                {bodyRendered ? (
                  <div className="prose prose-lg max-w-none dark:prose-invert">{bodyRendered}</div>
                ) : (
                  <p className="text-muted-foreground text-center">No content</p>
                )}
              </div>

              <div className="flex justify-between items-center pt-4">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={!canGoPrev || isNavigating}
                  className="text-muted-foreground text-body-sm hover:text-foreground gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />{' '}
                  {t('exercisesPagerPrev')}
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext || isNavigating}
                  className="px-6 py-2 rounded-xl text-body-sm cursor-pointer"
                >
                  {isNavigating ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : null}
                  {t('exercisesPagerNext')}
                </Button>
              </div>
            </div>
          </div>
        </main>
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
            <div className="flex-1 overflow-y-auto min-h-0">
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
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="shrink-0 border-t border-border bg-card px-4 py-3">
              <div className="flex justify-between items-center">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={!canGoPrev || isNavigating}
                  className="text-muted-foreground text-body-sm hover:text-foreground gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />{' '}
                  {t('exercisesPagerPrev')}
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext || isNavigating}
                  className="px-6 py-2 rounded-xl text-body-sm cursor-pointer"
                >
                  {isNavigating ? (
                    <>
                      <Loader2 className="w-4 h-4 me-2 animate-spin" />
                      {t('exercisesPagerNext')}
                    </>
                  ) : (
                    t('exercisesPagerNext')
                  )}
                </Button>
              </div>
            </div>
          </div>
        }
        chatContent={
          <ChatInterface
            lessonId={chatLessonId ?? lessonId}
            translationNamespace="courses"
            showMathTools={true}
            formulaSheet={formulaSheet}
          />
        }
      />
    )
  }

  // Intro and outro pages
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Progress value={progressPercent} className="h-1.5 rounded-none" />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 sm:px-6 py-section-md md:py-section-lg max-w-7xl">
          {pageState.type === 'intro' && (
            <div className="space-y-8">
              <header className="text-center">
                <span className="inline-block px-4 py-1.5 bg-muted text-muted-foreground rounded-full text-[10px] tracking-[0.2em] uppercase mb-5 border border-border/40">
                  {t('exercisesPagerIntro')}
                </span>
                <h1 className="text-display-md md:text-[42px] font-medium leading-tight text-foreground mb-3">
                  {lessonTitle}
                </h1>
                <div className="w-20 h-1 bg-primary mx-auto rounded-full" />
              </header>

              <div className="bg-card rounded-3xl p-card-padding-lg md:p-10 border border-border/60 shadow-card-hover shadow-muted/50 text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-card shadow-primary/10 border border-primary/20">
                  <BookOpen className="w-9 h-9 text-primary" />
                </div>

                <h2 className="text-display-xl font-medium mb-4 text-foreground">
                  {t('exercisesPagerWelcome')}
                </h2>
                <p className="text-muted-foreground mb-10 text-body-md leading-relaxed max-w-2xl mx-auto">
                  {t('exercisesPagerIntroDescriptionPart1')} {totalBlocks}{' '}
                  {t('exercisesPagerIntroDescriptionPart2')}
                </p>

                <div className="inline-flex items-center gap-3 px-5 py-3 bg-muted rounded-2xl border border-border/60 mb-10">
                  <Layers className="w-5 h-5 text-primary" />
                  <span className="text-primary text-heading-xl font-medium">{exerciseCount}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
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
            </div>
          )}

          {pageState.type === 'outro' && (
            <div className="space-y-8">
              <header className="text-center">
                <span className="inline-block px-4 py-1.5 bg-secondary/10 text-secondary rounded-full text-[10px] tracking-[0.2em] uppercase mb-5 border border-secondary/20">
                  {t('exercisesPagerCompleted')}
                </span>
                <h1 className="text-display-md md:text-[42px] font-medium leading-tight text-foreground mb-3">
                  {t('exercisesPagerCompletedTitle')}
                </h1>
                <div className="w-20 h-1 bg-secondary mx-auto rounded-full" />
              </header>

              <div className="bg-card rounded-3xl p-card-padding-lg md:p-10 border border-border/60 shadow-card-hover shadow-muted/50 text-center">
                <div className="w-20 h-20 bg-secondary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-card shadow-secondary/10 border border-secondary/20">
                  <Sparkles className="w-9 h-9 text-secondary" />
                </div>

                <h2 className="text-display-xl font-medium mb-4 text-foreground">
                  {t('exercisesPagerCompletedTitle')}
                </h2>
                <p className="text-muted-foreground mb-10 text-body-md leading-relaxed max-w-2xl mx-auto">
                  {t('exercisesPagerCompletedDescription')}
                </p>

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

              <div className="flex justify-center pt-4">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={isNavigating}
                  className="text-muted-foreground text-body-sm hover:text-foreground transition-colors duration-slow gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />{' '}
                  {t('exercisesPagerPrev')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
