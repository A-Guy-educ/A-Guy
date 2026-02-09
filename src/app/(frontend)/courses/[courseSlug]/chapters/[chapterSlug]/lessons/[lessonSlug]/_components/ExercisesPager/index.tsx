'use client'

import { useState } from 'react'
import type { Exercise } from '@/payload-types'
import { Button } from '@/ui/web/components/button'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/ui/web/components/card'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'

interface ExercisesPagerProps {
  exercises: Exercise[]
  lessonTitle: string
  backUrl: string
}

type PageType = 'intro' | 'exercise' | 'completed'

interface PageState {
  type: PageType
  /** 0 = intro, 1..N = exercise index, N+1 = completed */
  pageNumber: number
  /** For exercise pages, the exercise being displayed */
  exerciseIndex?: number
}

export function ExercisesPager({ exercises, lessonTitle, backUrl }: ExercisesPagerProps) {
  const t = useTranslations('courses')

  const [pageState, setPageState] = useState<PageState>({
    type: 'intro',
    pageNumber: 0,
  })

  const totalExercises = exercises.length
  const totalPages = totalExercises + 2 // intro + exercises + completed

  const handleNext = () => {
    const nextPage = pageState.pageNumber + 1

    if (nextPage === totalPages - 1) {
      // Moving to completed page
      setPageState({ type: 'completed', pageNumber: nextPage })
    } else if (nextPage > 0 && nextPage < totalPages - 1) {
      // Moving to an exercise page
      setPageState({
        type: 'exercise',
        pageNumber: nextPage,
        exerciseIndex: nextPage - 1,
      })
    }
  }

  const handlePrev = () => {
    const prevPage = pageState.pageNumber - 1

    if (prevPage === 0) {
      // Moving back to intro
      setPageState({ type: 'intro', pageNumber: 0 })
    } else if (prevPage > 0 && prevPage < totalPages - 1) {
      // Moving to a previous exercise
      setPageState({
        type: 'exercise',
        pageNumber: prevPage,
        exerciseIndex: prevPage - 1,
      })
    }
  }

  const handleStart = () => {
    setPageState({
      type: 'exercise',
      pageNumber: 1,
      exerciseIndex: 0,
    })
  }

  const canGoNext = pageState.pageNumber < totalPages - 1
  const canGoPrev = pageState.pageNumber > 0

  return (
    <div className="w-full h-full flex flex-col">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Intro Page */}
          {pageState.type === 'intro' && (
            <Card className="border-2">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-3xl md:text-4xl font-bold mb-4">{lessonTitle}</CardTitle>
                <CardDescription className="text-base md:text-lg">
                  {t('exercisesPagerIntroDescriptionPart1')} {totalExercises}{' '}
                  {t('exercisesPagerIntroDescriptionPart2')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 pb-8 flex justify-center">
                <Button onClick={handleStart} size="lg" className="min-w-[200px]">
                  {t('exercisesPagerStart')}
                  <ChevronLeft className="ms-2 h-5 w-5 rtl:rotate-0 ltr:rotate-180" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Exercise Page */}
          {pageState.type === 'exercise' && pageState.exerciseIndex !== undefined && (
            <div className="space-y-6">
              {/* Exercise Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {t('exercise')} {pageState.exerciseIndex + 1} {t('of')} {totalExercises}
                  </p>
                  <h2 className="text-2xl md:text-3xl font-bold">
                    {exercises[pageState.exerciseIndex]?.title}
                  </h2>
                </div>
              </div>

              {/* Exercise Content */}
              <ExerciseRenderer
                content={
                  exercises[pageState.exerciseIndex]?.content as unknown as ExerciseContentData
                }
                mode="student"
                showCheckAnswer={true}
              />
            </div>
          )}

          {/* Completed Page */}
          {pageState.type === 'completed' && (
            <Card className="border-2">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-3xl md:text-4xl font-bold mb-4">
                  {t('exercisesPagerCompletedTitle')}
                </CardTitle>
                <CardDescription className="text-base md:text-lg">
                  {t('exercisesPagerCompletedDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 pb-8 flex justify-center">
                <Button asChild size="lg" className="min-w-[200px]">
                  <SystemLink href={backUrl}>{t('exercisesPagerComplete')}</SystemLink>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Navigation Controls - Fixed at bottom */}
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          {/* Previous Button */}
          <Button
            onClick={handlePrev}
            disabled={!canGoPrev}
            variant="outline"
            size="lg"
            className="min-w-[120px]"
          >
            <ChevronRight className="me-2 h-5 w-5 rtl:rotate-0 ltr:rotate-180" />
            {t('exercisesPagerPrev')}
          </Button>

          {/* Page Indicator */}
          <div className="text-sm text-muted-foreground hidden sm:block">
            {pageState.type === 'intro' && t('exercisesPagerIntro')}
            {pageState.type === 'exercise' &&
              `${t('exercise')} ${pageState.exerciseIndex! + 1}/${totalExercises}`}
            {pageState.type === 'completed' && t('exercisesPagerCompleted')}
          </div>

          {/* Next Button */}
          <Button onClick={handleNext} disabled={!canGoNext} size="lg" className="min-w-[120px]">
            {t('exercisesPagerNext')}
            <ChevronLeft className="ms-2 h-5 w-5 rtl:rotate-0 ltr:rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  )
}
