'use client'

import type { Exercise, Media as MediaType } from '@/payload-types'
import { Button } from '@/ui/web/components/button'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import { BookOpen, ChevronLeft, ChevronRight, Info, Layers, Sparkles } from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'
import { Progress } from '@/ui/web/components/progress'
import { useExercisesPager } from './useExercisesPager'
import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { ChatInterface } from '@/ui/web/chat'
import { getMediaUrl } from '@/infra/utils/getMediaUrl'

interface ExercisesPagerProps {
  exercises: Exercise[]
  lessonTitle: string
  backUrl: string
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  lessonId: string
  introDescription?: string | null
  introMedia?: MediaType | string | number | null
  mediaMap?: Record<string, MediaType>
}

export function ExercisesPager({
  exercises,
  lessonTitle,
  backUrl,
  courseSlug,
  chapterSlug,
  lessonSlug,
  lessonId,
  introDescription,
  introMedia,
  mediaMap,
}: ExercisesPagerProps) {
  const t = useTranslations('courses')
  const hasAboutPage = Boolean(introDescription || (introMedia && typeof introMedia === 'object'))
  const {
    pageState,
    progressPercent,
    canGoNext,
    canGoPrev,
    handleNext,
    handlePrev,
    handleStart,
    handleStartExercises,
    getExerciseOrdinal,
    totalExercises,
  } = useExercisesPager({ exercises, courseSlug, chapterSlug, lessonSlug, hasAboutPage })

  const introMediaObj = introMedia && typeof introMedia === 'object' ? introMedia : null

  const exerciseOrdinal = getExerciseOrdinal()
  const currentExercise =
    typeof pageState.exerciseIndex === 'number' ? exercises[pageState.exerciseIndex] : null

  if (pageState.type === 'exercise' && currentExercise) {
    return (
      <ExerciseWorkspace
        exerciseTitle={currentExercise.title}
        backUrl={backUrl}
        primaryContent={
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="w-full p-4 md:p-6 space-y-4">
                <Progress value={progressPercent} className="h-1 rounded-full" />

                <div className="bg-card rounded-2xl p-5 md:p-6 border border-border/60 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Layers className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
                        {exerciseOrdinal !== null
                          ? `${t('exercise')} ${exerciseOrdinal} ${t('of')} ${totalExercises}`
                          : ''}
                      </p>
                      <h2 className="text-lg font-medium text-foreground">
                        {currentExercise.title}
                      </h2>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-2xl p-5 md:p-6 border border-border/60 shadow-sm">
                  <ExerciseRenderer
                    content={currentExercise.content as unknown as ExerciseContentData}
                    mode="student"
                    showCheckAnswer={true}
                    mediaMap={mediaMap}
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-border bg-card px-4 py-3">
              <div className="flex justify-between items-center">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={!canGoPrev}
                  className="text-muted-foreground text-sm hover:text-foreground gap-1.5"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />{' '}
                  {t('exercisesPagerPrev')}
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext}
                  className="px-6 py-2 rounded-xl text-sm"
                >
                  {t('exercisesPagerNext')}
                </Button>
              </div>
            </div>
          </div>
        }
        chatContent={
          <ChatInterface
            lessonId={lessonId}
            exerciseId={currentExercise.id}
            translationNamespace="courses"
            showMathTools={true}
          />
        }
      />
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Progress value={progressPercent} className="h-1.5 rounded-none" />

      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 sm:px-6 py-8 md:py-12 max-w-3xl">
          {pageState.type === 'intro' && (
            <div className="space-y-8">
              <header className="text-center">
                <span className="inline-block px-4 py-1.5 bg-muted text-muted-foreground rounded-full text-[10px] tracking-[0.2em] uppercase mb-5 border border-border/40">
                  {t('exercisesPagerIntro')}
                </span>
                <h1 className="text-4xl md:text-[42px] font-medium leading-tight text-foreground mb-3">
                  {lessonTitle}
                </h1>
                <div className="w-20 h-1 bg-primary mx-auto rounded-full" />
              </header>

              <div className="bg-card rounded-3xl p-8 md:p-10 border border-border/60 shadow-xl shadow-muted/50 text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-primary/10 border border-primary/20">
                  <BookOpen className="w-9 h-9 text-primary" />
                </div>

                <h2 className="text-2xl font-medium mb-4 text-foreground">
                  {t('exercisesPagerWelcome')}
                </h2>
                <p className="text-muted-foreground mb-10 text-base leading-relaxed max-w-md mx-auto">
                  {t('exercisesPagerIntroDescriptionPart1')} {totalExercises}{' '}
                  {t('exercisesPagerIntroDescriptionPart2')}
                </p>

                <div className="inline-flex items-center gap-3 px-5 py-3 bg-muted rounded-2xl border border-border/60 mb-10">
                  <Layers className="w-5 h-5 text-primary" />
                  <span className="text-primary text-xl font-medium">{totalExercises}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t('exercise')}
                  </span>
                </div>

                <Button
                  onClick={handleStart}
                  size="lg"
                  className="w-full py-6 rounded-2xl text-lg shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                >
                  {t('exercisesPagerStart')}{' '}
                  <ChevronLeft className="w-5 h-5 ms-2 rtl:rotate-0 ltr:rotate-180" />
                </Button>
              </div>
            </div>
          )}

          {pageState.type === 'about' && (
            <div className="space-y-8">
              <header className="text-center">
                <span className="inline-block px-4 py-1.5 bg-muted text-muted-foreground rounded-full text-[10px] tracking-[0.2em] uppercase mb-5 border border-border/40">
                  {t('exercisesPagerIntro')}
                </span>
                <h1 className="text-4xl md:text-[42px] font-medium leading-tight text-foreground mb-3">
                  {lessonTitle}
                </h1>
                <div className="w-20 h-1 bg-primary mx-auto rounded-full" />
              </header>

              <div className="bg-card rounded-3xl p-8 md:p-10 border border-border/60 shadow-xl shadow-muted/50">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-primary/10 border border-primary/20">
                  <Info className="w-9 h-9 text-primary" />
                </div>

                {introDescription && (
                  <div
                    className="prose prose-lg dark:prose-invert max-w-md mx-auto mb-8 text-muted-foreground leading-relaxed text-start [&_ul]:list-inside [&_ol]:list-inside"
                    dangerouslySetInnerHTML={{ __html: introDescription }}
                  />
                )}

                {introMediaObj?.url && (
                  <div className="mx-auto max-h-80 overflow-hidden rounded-2xl mb-8">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getMediaUrl(introMediaObj.url)}
                      alt={introMediaObj.alt || ''}
                      className="mx-auto max-h-80 w-auto object-contain"
                    />
                  </div>
                )}

                <Button
                  onClick={handleStartExercises}
                  size="lg"
                  className="w-full py-6 rounded-2xl text-lg shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                >
                  {t('startLesson')}{' '}
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
                <h1 className="text-4xl md:text-[42px] font-medium leading-tight text-foreground mb-3">
                  {t('exercisesPagerCompletedTitle')}
                </h1>
                <div className="w-20 h-1 bg-secondary mx-auto rounded-full" />
              </header>

              <div className="bg-card rounded-3xl p-8 md:p-10 border border-border/60 shadow-xl shadow-muted/50 text-center">
                <div className="w-20 h-20 bg-secondary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-secondary/10 border border-secondary/20">
                  <Sparkles className="w-9 h-9 text-secondary" />
                </div>

                <h2 className="text-2xl font-medium mb-4 text-foreground">
                  {t('exercisesPagerCompletedTitle')}
                </h2>
                <p className="text-muted-foreground mb-10 text-base leading-relaxed max-w-md mx-auto">
                  {t('exercisesPagerCompletedDescription')}
                </p>

                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="w-full py-6 rounded-2xl text-lg shadow-lg shadow-secondary/20 hover:shadow-xl hover:shadow-secondary/30 transition-all duration-300"
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
                  className="text-muted-foreground text-sm hover:text-foreground transition-colors duration-300 gap-1.5"
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
