'use client'

import { EmptyState } from '@/app/(frontend)/courses/_components/EmptyState'
import { ExerciseCard } from '@/app/(frontend)/courses/_components/ExerciseCard'
import type { Exercise, Media as MediaType } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Media as MediaComponent } from '@/ui/web/media'
import { useState } from 'react'
import { ConvertButton } from './ConvertButton'
import { ViewToggle } from './ViewToggle'

type ViewMode = 'non-interactive' | 'interactive'

interface LessonContentProps {
  contentFiles?: MediaType[] | null
  lessonTitle: string
  exercises: Exercise[]
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  lessonId: string
  isAdmin: boolean
}

export function LessonContent({
  contentFiles,
  lessonTitle: _lessonTitle,
  exercises,
  courseSlug,
  chapterSlug,
  lessonSlug,
  lessonId,
  isAdmin,
}: LessonContentProps) {
  const t = useTranslations('courses')
  const validFiles = contentFiles?.filter((file) => file?.url) || []
  const hasContent = validFiles.length > 0
  const hasExercises = exercises.length > 0

  // Only show exercises toggle to admins
  const showExercisesToggle = isAdmin
  const initialViewMode: ViewMode =
    !hasContent && showExercisesToggle ? 'interactive' : 'non-interactive'
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)

  return (
    <>
      <ViewToggle
        hasPdf={hasContent}
        hasExercises={showExercisesToggle}
        initialMode={initialViewMode}
        onViewChange={setViewMode}
      />

      <section className="mb-8">
        {viewMode === 'non-interactive' ? (
          <>
            {hasContent ? (
              <div className="flex flex-col gap-0">
                {validFiles.map((file, index) => (
                  <div key={file.id} className="w-full min-h-[841px] flex-shrink-0">
                    {index > 0 && (
                      <div
                        className="h-0.5 my-8 flex-shrink-0"
                        style={{
                          background:
                            'linear-gradient(to right, transparent, hsl(var(--border)) 20%, hsl(var(--border)) 80%, transparent)',
                        }}
                      />
                    )}
                    <div className="border rounded-lg overflow-hidden bg-gray-50">
                      <MediaComponent resource={file} className="w-full" htmlElement={null} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState type="noPDF" />
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <div className="mb-6">
                <h2 className="text-2xl font-bold">{t('exercisesTitle')}</h2>
                <p className="text-muted-foreground">{t('exercisesDescription')}</p>
              </div>
              {hasExercises ? (
                <div className="flex flex-col gap-3">
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
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <p className="text-muted-foreground mb-4">No exercises yet for this lesson</p>
                  {isAdmin && hasContent && (
                    <div className="mt-6">
                      <ConvertButton lessonId={lessonId} />
                    </div>
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
