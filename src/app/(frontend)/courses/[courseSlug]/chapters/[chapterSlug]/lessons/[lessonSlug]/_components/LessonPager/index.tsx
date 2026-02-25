'use client'

import type { Media as MediaType } from '@/payload-types'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'
import type { LessonBlock, LessonPagerProps } from './lessonPagerTypes'

import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { getMediaUrl } from '@/infra/utils/getMediaUrl'
import { Button } from '@/ui/web/components/button'
import { Progress } from '@/ui/web/components/progress'
import { ChatInterface } from '@/ui/web/chat'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import { useTranslations } from '@/ui/web/providers/I18n'
import { SafeHtml } from '@/ui/web/SafeHtml'
import { BookOpen, ChevronLeft, ChevronRight, FileText, Info, Layers, Sparkles } from 'lucide-react'
import { useLessonPager } from './useLessonPager'

export function LessonPager({
  blocks,
  lessonTitle,
  backUrl,
  courseSlug,
  chapterSlug,
  lessonSlug,
  lessonId,
  introDescription,
  introMedia,
  mediaMap,
}: LessonPagerProps) {
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
    handleStartBlocks,
    getExerciseOrdinal,
    totalExercises,
    totalBlocks,
  } = useLessonPager({ blocks, courseSlug, chapterSlug, lessonSlug, hasAboutPage })

  const introMediaObj = introMedia && typeof introMedia === 'object' ? introMedia : null

  const currentBlock: LessonBlock | null =
    typeof pageState.blockIndex === 'number' ? (blocks[pageState.blockIndex] ?? null) : null

  // Render exercise block in ExerciseWorkspace
  if (pageState.type === 'block' && currentBlock?.blockType === 'exerciseRef') {
    const exercise = currentBlock.exercise
    const exerciseOrdinal = getExerciseOrdinal()

    return (
      <ExerciseWorkspace
        exerciseTitle={exercise.title}
        backUrl={backUrl}
        primaryContent={
          <ExerciseBlockContent
            exercise={exercise}
            exerciseOrdinal={exerciseOrdinal}
            totalExercises={totalExercises}
            progressPercent={progressPercent}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            handlePrev={handlePrev}
            handleNext={handleNext}
            mediaMap={mediaMap}
            t={t}
          />
        }
        chatContent={
          <ChatInterface
            lessonId={lessonId}
            exerciseId={exercise.id}
            currentExercise={{
              id: exercise.id,
              title: exercise.title,
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
          />
        }
      />
    )
  }

  // Render content page block in ExerciseWorkspace
  if (pageState.type === 'block' && currentBlock?.blockType === 'contentPageRef') {
    const contentPage = currentBlock.contentPage

    return (
      <ExerciseWorkspace
        exerciseTitle={contentPage.title}
        backUrl={backUrl}
        primaryContent={
          <ContentPageBlockContent
            contentPage={contentPage}
            progressPercent={progressPercent}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            handlePrev={handlePrev}
            handleNext={handleNext}
            t={t}
          />
        }
        chatContent={
          <ChatInterface lessonId={lessonId} translationNamespace="courses" showMathTools={false} />
        }
      />
    )
  }

  // Intro, About, and Outro pages
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Progress value={progressPercent} className="h-1.5 rounded-none" />

      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 sm:px-6 py-8 md:py-12 max-w-3xl">
          {pageState.type === 'intro' && (
            <IntroPage
              lessonTitle={lessonTitle}
              totalBlocks={totalBlocks}
              handleStart={handleStart}
              t={t}
            />
          )}

          {pageState.type === 'about' && (
            <AboutPage
              lessonTitle={lessonTitle}
              introDescription={introDescription}
              introMediaObj={introMediaObj}
              handleStartBlocks={handleStartBlocks}
              t={t}
            />
          )}

          {pageState.type === 'outro' && (
            <OutroPage backUrl={backUrl} handlePrev={handlePrev} t={t} />
          )}
        </div>
      </main>
    </div>
  )
}

// --- Sub-components (extracted to stay under 150-line limit) ---

function IntroPage({
  lessonTitle,
  totalBlocks,
  handleStart,
  t,
}: {
  lessonTitle: string
  totalBlocks: number
  handleStart: () => void
  t: ReturnType<typeof useTranslations>
}) {
  return (
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

        <h2 className="text-2xl font-medium mb-4 text-foreground">{t('exercisesPagerWelcome')}</h2>
        <p className="text-muted-foreground mb-10 text-base leading-relaxed max-w-md mx-auto">
          {t('exercisesPagerIntroDescriptionPart1')} {totalBlocks}{' '}
          {t('exercisesPagerIntroDescriptionPart2')}
        </p>

        <div className="inline-flex items-center gap-3 px-5 py-3 bg-muted rounded-2xl border border-border/60 mb-10">
          <Layers className="w-5 h-5 text-primary" />
          <span className="text-primary text-xl font-medium">{totalBlocks}</span>
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
  )
}

function AboutPage({
  lessonTitle,
  introDescription,
  introMediaObj,
  handleStartBlocks,
  t,
}: {
  lessonTitle: string
  introDescription?: string | null
  introMediaObj: MediaType | null
  handleStartBlocks: () => void
  t: ReturnType<typeof useTranslations>
}) {
  return (
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
          <SafeHtml
            html={introDescription}
            className="prose prose-lg dark:prose-invert max-w-md mx-auto mb-8 text-muted-foreground leading-relaxed text-start [&_ul]:list-inside [&_ol]:list-inside"
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
          onClick={handleStartBlocks}
          size="lg"
          className="w-full py-6 rounded-2xl text-lg shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
        >
          {t('startLesson')} <ChevronLeft className="w-5 h-5 ms-2 rtl:rotate-0 ltr:rotate-180" />
        </Button>
      </div>
    </div>
  )
}

function OutroPage({
  backUrl,
  handlePrev,
  t,
}: {
  backUrl: string
  handlePrev: () => void
  t: ReturnType<typeof useTranslations>
}) {
  return (
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
          <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" /> {t('exercisesPagerPrev')}
        </Button>
      </div>
    </div>
  )
}

function ExerciseBlockContent({
  exercise,
  exerciseOrdinal,
  totalExercises,
  progressPercent,
  canGoPrev,
  canGoNext,
  handlePrev,
  handleNext,
  mediaMap,
  t,
}: {
  exercise: { title: string; content: unknown }
  exerciseOrdinal: number | null
  totalExercises: number
  progressPercent: number
  canGoPrev: boolean
  canGoNext: boolean
  handlePrev: () => void
  handleNext: () => void
  mediaMap?: Record<string, MediaType>
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="w-full p-4 md:p-6 space-y-4">
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden mt-4">
            <Progress value={progressPercent} className="h-1.5 rounded-none" />

            <div className="p-5 md:p-6">
              <p className="text-start text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                {exerciseOrdinal !== null
                  ? `${t('exercise')} ${exerciseOrdinal} ${t('of')} ${totalExercises}`
                  : ''}
              </p>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Layers className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-foreground">{exercise.title}</h2>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-5 md:p-6 border border-border/60 shadow-sm">
            <ExerciseRenderer
              content={exercise.content as unknown as ExerciseContentData}
              mode="student"
              showCheckAnswer={true}
              mediaMap={mediaMap}
            />
          </div>
        </div>
      </div>

      <PagerNavigation
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        handlePrev={handlePrev}
        handleNext={handleNext}
        t={t}
      />
    </div>
  )
}

function ContentPageBlockContent({
  contentPage,
  progressPercent,
  canGoPrev,
  canGoNext,
  handlePrev,
  handleNext,
  t,
}: {
  contentPage: { title: string; htmlContent: string }
  progressPercent: number
  canGoPrev: boolean
  canGoNext: boolean
  handlePrev: () => void
  handleNext: () => void
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="w-full p-4 md:p-6 space-y-4">
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden mt-4">
            <Progress value={progressPercent} className="h-1.5 rounded-none" />

            <div className="p-5 md:p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-foreground">{contentPage.title}</h2>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-5 md:p-6 border border-border/60 shadow-sm">
            <SafeHtml
              html={contentPage.htmlContent}
              className="prose prose-lg dark:prose-invert max-w-none text-start [&_a]:text-primary [&_a]:underline [&_ul]:list-inside [&_ol]:list-inside"
            />
          </div>
        </div>
      </div>

      <PagerNavigation
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        handlePrev={handlePrev}
        handleNext={handleNext}
        t={t}
      />
    </div>
  )
}

function PagerNavigation({
  canGoPrev,
  canGoNext,
  handlePrev,
  handleNext,
  t,
}: {
  canGoPrev: boolean
  canGoNext: boolean
  handlePrev: () => void
  handleNext: () => void
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="shrink-0 border-t border-border bg-card px-4 py-3">
      <div className="flex justify-between items-center">
        <Button
          variant="ghost"
          onClick={handlePrev}
          disabled={!canGoPrev}
          className="text-muted-foreground text-sm hover:text-foreground gap-1.5"
        >
          <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" /> {t('exercisesPagerPrev')}
        </Button>
        <Button onClick={handleNext} disabled={!canGoNext} className="px-6 py-2 rounded-xl text-sm">
          {t('exercisesPagerNext')}
        </Button>
      </div>
    </div>
  )
}
