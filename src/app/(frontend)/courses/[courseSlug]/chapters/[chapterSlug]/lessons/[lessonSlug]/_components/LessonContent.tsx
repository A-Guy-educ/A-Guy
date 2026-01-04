'use client'

import { useState } from 'react'
import { ViewToggle } from './ViewToggle'
import { PDFViewer } from '@/components/utilities/PDFViewer'
import { ExerciseCard } from '@/app/(frontend)/courses/_components/ExerciseCard'
import { EmptyState } from '@/app/(frontend)/courses/_components/EmptyState'
import { useTranslations } from '@/providers/I18n'
import Link from 'next/link'
import type { Exercise } from '@/payload-types'
import { PlusIcon } from './PlusIcon'
import styles from './LessonContent.module.css'

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

      <section className={styles.section}>
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
            <div className={styles.exercisesContainer}>
              <div className={styles.header}>
                <div className={styles.headerTop}>
                  <h2 className={styles.title}>{t('exercisesTitle')}</h2>
                  {isAdmin && (
                    <Link
                      href={`/admin/ai-exercise-creator?lessonId=${lessonId}&lessonSlug=${lessonSlug}&courseSlug=${courseSlug}&chapterSlug=${chapterSlug}`}
                      className={styles.createButton}
                    >
                      <PlusIcon className={styles.buttonIcon} />
                      AI Exercise Creator
                    </Link>
                  )}
                </div>
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
                  {isAdmin && (
                    <p className={styles.emptyStateHint}>
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
