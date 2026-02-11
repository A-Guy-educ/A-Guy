'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import { getSectionLabel } from '@/infra/utils/getSectionLabel'
import type { Exercise } from '@/payload-types'
import { Button } from '@/ui/web/components/button'
import { Progress } from '@/ui/web/components/progress'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { BookOpen, ChevronLeft, ChevronRight, Layers, Sparkles } from 'lucide-react'
import { useExercisesPager } from './useExercisesPager'

interface ExercisesPagerProps {
  exercises: Exercise[]
  lessonTitle: string
  backUrl: string
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  lessonId: string
}

export function ExercisesPager({
  exercises,
  lessonTitle,
  backUrl,
  courseSlug,
  chapterSlug,
  lessonSlug,
  lessonId: _lessonId,
}: ExercisesPagerProps) {
  const t = useTranslations('courses')
  const locale = useLocale()
  const pager = useExercisesPager({ exercises, courseSlug, chapterSlug, lessonSlug })
  const sectionLabel =
    pager.pageState.type === 'exercise' && pager.pageState.exerciseIndex !== undefined
      ? getSectionLabel({ index: pager.pageState.exerciseIndex, locale })
      : null
  const { pageState, progressPercent, canGoNext, canGoPrev, handleNext, handlePrev, handleStart, totalExercises } =
    pager

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

          {pageState.type === 'exercise' && typeof pageState.exerciseIndex === 'number' && (
            <div className="space-y-8">
              <div className="bg-card rounded-3xl p-6 md:p-8 border border-border/60 shadow-lg shadow-muted/40 relative overflow-hidden">
                <div className="absolute top-0 end-0 w-1.5 h-full bg-primary rounded-s-full" />
                {/* TEMPORARY MARKER: SECTION LABEL ENABLED */}
                {process.env.NODE_ENV !== 'production' && (
                  <div className="absolute top-2 end-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded font-bold">
                    SECTION LABEL ENABLED
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Layers className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {sectionLabel && (
                        <span data-testid="section-label-badge" className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-primary/10 text-primary text-[11px] font-medium border border-primary/20">
                          {sectionLabel}
                        </span>
                      )}
                      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
                        {t('exercise')} {pageState.exerciseIndex + 1} {t('of')} {exercises.length}
                      </p>
                    </div>
                    <h2 className="text-xl font-medium text-foreground truncate">
                      {exercises[pageState.exerciseIndex]?.title}
                    </h2>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-3xl p-6 md:p-8 border border-border/60 shadow-lg shadow-muted/40">
                {typeof pageState.exerciseIndex === 'number' &&
                  exercises[pageState.exerciseIndex] && (
                    <ExerciseRenderer
                      content={
                        exercises[pageState.exerciseIndex]!
                          .content as unknown as ExerciseContentData
                      }
                      mode="student"
                      showCheckAnswer={true}
                    />
                  )}
              </div>

              <div className="flex justify-between items-center pt-4">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={!canGoPrev}
                  className="text-muted-foreground text-sm hover:text-foreground transition-colors duration-300 gap-1.5"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />{' '}
                  {t('exercisesPagerPrev')}
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext}
                  size="lg"
                  className="px-10 py-4 rounded-2xl text-base shadow-lg shadow-primary/20 hover:shadow-xl transition-all duration-300"
                >
                  {t('exercisesPagerNext')}
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
