'use client'

import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import type { Media } from '@/payload-types'
import { ChatInterface } from '@/ui/web/chat'
import { Button } from '@/ui/web/components/button'
import { Progress } from '@/ui/web/components/progress'
import { Media as MediaComponent } from '@/ui/web/media'
import { useTranslations } from '@/ui/web/providers/I18n'
import { BookOpen, ChevronLeft, ChevronRight, FileText, Loader2, Sparkles } from 'lucide-react'
import { usePdfLessonPager } from './usePdfLessonPager'

interface PdfLessonPagerProps {
  validFiles: Media[]
  lessonTitle: string
  backUrl: string
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  lessonId: string
  chatLessonId: string
  /** Formula sheet data (passed to ChatInterface) */
  formulaSheet?: import('@/payload-types').FormulaSheet | null
}

export function PdfLessonPager({
  validFiles,
  lessonTitle,
  backUrl,
  courseSlug,
  chapterSlug,
  lessonSlug,
  lessonId,
  chatLessonId,
  formulaSheet,
}: PdfLessonPagerProps) {
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
    totalFiles,
  } = usePdfLessonPager({
    fileCount: validFiles.length,
    courseSlug,
    chapterSlug,
    lessonSlug,
    lessonId,
  })

  if (pageState.type === 'pdf') {
    const primaryContent = (
      <div className="w-full flex flex-col gap-content-gap">
        {validFiles.map((file) => (
          <div key={file.id} className="w-full h-[calc(100vh-120px)]">
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
    )

    return (
      <ExerciseWorkspace
        exerciseTitle={lessonTitle}
        backUrl={backUrl}
        primaryContent={
          <div className="h-full flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="w-full p-card-padding-sm md:p-card-padding">{primaryContent}</div>
            </div>

            <div className="shrink-0 border-t border-border bg-card px-4 py-3">
              <div className="flex justify-between items-center">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={!canGoPrev || isNavigating}
                  className="text-muted-foreground text-body-sm hover:text-foreground gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
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
            lessonId={chatLessonId}
            translationNamespace="courses"
            showMathTools={true}
            formulaSheet={formulaSheet}
          />
        }
      />
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Progress value={progressPercent} className="h-1.5 rounded-none" />

      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 sm:px-6 py-section-md md:py-section-lg max-w-7xl">
          {pageState.type === 'intro' && (
            <div className="space-y-8">
              <header className="text-center">
                <span className="inline-block px-4 py-1.5 bg-muted text-muted-foreground rounded-full text-label tracking-[0.2em] uppercase mb-5 border border-border/40">
                  {t('exercisesPagerIntro')}
                </span>
                <h1 className="text-display-md md:text-display-lg font-medium leading-tight text-foreground mb-3">
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
                  {t('pdfLessonPagerIntroDescriptionPart1')} {totalFiles}{' '}
                  {t('pdfLessonPagerIntroDescriptionPart2')}
                </p>

                <div className="inline-flex items-center gap-3 px-5 py-3 bg-muted rounded-2xl border border-border/60 mb-10">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="text-primary text-heading-xl font-medium">{totalFiles}</span>
                  <span className="text-label text-muted-foreground uppercase tracking-wider">
                    {t('pdfLessonPagerDocuments')}
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
                <span className="inline-block px-4 py-1.5 bg-secondary/10 text-secondary rounded-full text-label tracking-[0.2em] uppercase mb-5 border border-secondary/20">
                  {t('exercisesPagerCompleted')}
                </span>
                <h1 className="text-display-md md:text-display-lg font-medium leading-tight text-foreground mb-3">
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
                  {t('pdfLessonPagerCompletedDescription')}
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
                  <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
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
