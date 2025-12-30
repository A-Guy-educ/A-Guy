'use client'

import { useState } from 'react'
import { ViewToggle } from './ViewToggle'
import { PDFViewer } from '@/components/utilities/PDFViewer'
import { ExerciseCard } from '@/app/(frontend)/courses/_components/ExerciseCard'
import { EmptyState } from '@/app/(frontend)/courses/_components/EmptyState'
import { useTranslations } from '@/providers/I18n'
import type { Exercise } from '@/payload-types'

type ViewMode = 'non-interactive' | 'interactive'

interface LessonContentProps {
  pdfUrl?: string | null
  lessonTitle: string
  exercises: Exercise[]
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
}

export function LessonContent({
  pdfUrl,
  lessonTitle,
  exercises,
  courseSlug,
  chapterSlug,
  lessonSlug,
}: LessonContentProps) {
  const t = useTranslations('courses')
  const hasPdf = Boolean(pdfUrl)
  const hasExercises = exercises.length > 0

  // Default to interactive mode if no PDF but has exercises
  const initialViewMode: ViewMode = !hasPdf && hasExercises ? 'interactive' : 'non-interactive'
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)

  return (
    <>
      <ViewToggle
        hasPdf={hasPdf}
        hasExercises={hasExercises}
        initialMode={initialViewMode}
        onViewChange={setViewMode}
      />

      <section className="mb-8">
        {viewMode === 'non-interactive' ? (
          <>
            {hasPdf ? (
              <PDFViewer pdfUrl={pdfUrl!} lessonTitle={lessonTitle} />
            ) : (
              <EmptyState type="noPDF" />
            )}
          </>
        ) : (
          <>
            {hasExercises ? (
              <div className="space-y-4">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">{t('exercisesTitle')}</h2>
                  <p className="text-muted-foreground">{t('exercisesDescription')}</p>
                </div>
                <div className="space-y-3">
                  {exercises.map((exercise, index) => (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      courseSlug={courseSlug}
                      chapterSlug={chapterSlug}
                      lessonSlug={lessonSlug}
                      index={index}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState type="noLessons" />
            )}
          </>
        )}
      </section>
    </>
  )
}
