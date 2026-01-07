'use client'

import { useState } from 'react'
import { ViewToggle } from './ViewToggle'
import { PDFViewer } from '@/components/utilities/PDFViewer'
import { ExerciseCard } from '@/app/(frontend)/courses/_components/ExerciseCard'
import { EmptyState } from '@/app/(frontend)/courses/_components/EmptyState'
import { useTranslations } from '@/providers/I18n'
import type { Exercise, Media } from '@/payload-types'
import styles from './LessonContent.module.css'
import { ConvertButton } from './ConvertButton'

type ViewMode = 'non-interactive' | 'interactive'

interface LessonContentProps {
  contentFiles?: Media[] | null
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
  lessonTitle,
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

  // For admins: always show exercises option, default to interactive if no content
  // For others: only show if has exercises
  const showExercisesToggle = isAdmin || hasExercises
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

      <section className={styles.section}>
        {viewMode === 'non-interactive' ? (
          <>
            {hasContent ? (
              <div className={styles.mediaFilesContainer}>
                {validFiles.map((file, index) => (
                  <div key={file.id} className={styles.mediaFileWrapper}>
                    {index > 0 && <div className={styles.fileSeparator} />}
                    <PDFViewer
                      pdfUrl={file.url!}
                      lessonTitle={`${lessonTitle}${validFiles.length > 1 ? ` - Part ${index + 1}` : ''}`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState type="noPDF" />
            )}
          </>
        ) : (
          <>
            <div className={styles.exercisesContainer}>
              <div className={styles.header}>
                <h2 className={styles.title}>{t('exercisesTitle')}</h2>
                <p className={styles.description}>{t('exercisesDescription')}</p>
              </div>
              {hasExercises ? (
                <div className={styles.exercisesList}>
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
                <div className={styles.emptyState}>
                  <p className={styles.emptyStateText}>No exercises yet for this lesson</p>
                  {isAdmin && hasContent && (
                    <div className={styles.convertButtonWrapper}>
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
