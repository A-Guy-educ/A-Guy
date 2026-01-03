'use client'

import { useState } from 'react'
import { ViewToggle } from './ViewToggle'
import { PDFViewer } from '@/components/utilities/PDFViewer'
import { ExerciseCard } from '@/app/(frontend)/courses/_components/ExerciseCard'
import { EmptyState } from '@/app/(frontend)/courses/_components/EmptyState'
import { useTranslations } from '@/providers/I18n'
import Link from 'next/link'
import type { Exercise } from '@/payload-types'

type ViewMode = 'non-interactive' | 'interactive'

interface LessonContentProps {
  pdfUrl?: string | null
  lessonTitle: string
  exercises: Exercise[]
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  lessonId: string
  isAdmin: boolean
}

export function LessonContent({
  pdfUrl,
  lessonTitle,
  exercises,
  courseSlug,
  chapterSlug,
  lessonSlug,
  lessonId,
  isAdmin,
}: LessonContentProps) {
  const t = useTranslations('courses')
  const hasPdf = Boolean(pdfUrl)
  const hasExercises = exercises.length > 0

  // For admins: always show exercises option, default to interactive if no PDF
  // For others: only show if has exercises
  const showExercisesToggle = isAdmin || hasExercises
  const initialViewMode: ViewMode =
    !hasPdf && showExercisesToggle ? 'interactive' : 'non-interactive'
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)

  return (
    <>
      <ViewToggle
        hasPdf={hasPdf}
        hasExercises={showExercisesToggle}
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
            <div className="space-y-4">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold">{t('exercisesTitle')}</h2>
                  {isAdmin && (
                    <Link
                      href={`/admin/ai-exercise-creator?lessonId=${lessonId}&lessonSlug=${lessonSlug}`}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      AI Exercise Creator
                    </Link>
                  )}
                </div>
                <p className="text-muted-foreground">{t('exercisesDescription')}</p>
              </div>
              {hasExercises ? (
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
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <p className="text-gray-500 mb-4">No exercises yet for this lesson</p>
                  {isAdmin && (
                    <p className="text-sm text-gray-400">
                      Click &ldquo;AI Exercise Creator&rdquo; above to generate exercises from
                      images
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </>
  )
}
