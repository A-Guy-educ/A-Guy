'use client'

import React, { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { useTranslation } from './useTranslation'
import { TranslationModal } from './TranslationModal'

interface TranslateActionProps {
  collectionSlug: 'courses' | 'chapters' | 'lessons' | 'exercises'
}

export const TranslateAction: React.FC<TranslateActionProps> = ({ collectionSlug }) => {
  const { id } = useDocumentInfo()
  const [showModal, setShowModal] = useState(false)
  const { status, error, result, translate, reset } = useTranslation()

  if (!id) return null

  const handleTranslate = (params: {
    targetLocale: string
    promptId?: string
    targetCourseId?: string
    targetChapterId?: string
    targetLessonId?: string
  }) => {
    if (collectionSlug === 'courses') {
      translate({
        scope: 'course',
        courseId: id,
        targetLocale: params.targetLocale,
        promptId: params.promptId,
      })
    } else if (collectionSlug === 'chapters') {
      if (!params.targetCourseId) return
      translate({
        scope: 'chapter',
        chapterId: id,
        targetLocale: params.targetLocale,
        targetCourseId: params.targetCourseId,
        promptId: params.promptId,
      })
    } else if (collectionSlug === 'lessons') {
      if (!params.targetChapterId) return
      translate({
        scope: 'lesson',
        lessonId: id,
        targetLocale: params.targetLocale,
        targetChapterId: params.targetChapterId,
        includeExercises: true,
        promptId: params.promptId,
      })
    } else if (collectionSlug === 'exercises') {
      if (!params.targetLessonId) return
      translate({
        scope: 'exercise',
        exerciseId: id,
        targetLocale: params.targetLocale,
        targetLessonId: params.targetLessonId,
        promptId: params.promptId,
      })
    }
  }

  const handleClose = () => {
    setShowModal(false)
    if (status !== 'idle') reset()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          fontSize: 13,
          fontWeight: 500,
          border: '1px solid var(--theme-elevation-200)',
          borderRadius: 4,
          backgroundColor: 'var(--theme-elevation-0)',
          color: 'var(--theme-elevation-1000)',
          cursor: 'pointer',
        }}
        title="Translate this document"
      >
        Translate
      </button>
      <TranslationModal
        isOpen={showModal}
        onClose={handleClose}
        onConfirm={handleTranslate}
        collectionSlug={collectionSlug}
        isTranslating={status === 'loading'}
        translationError={error}
        translationSuccess={status === 'success'}
        translationResult={result}
      />
    </>
  )
}

// Named exports for each collection — Payload needs a direct component reference
export const TranslateCourseAction: React.FC = () => <TranslateAction collectionSlug="courses" />
export const TranslateChapterAction: React.FC = () => <TranslateAction collectionSlug="chapters" />
export const TranslateLessonAction: React.FC = () => <TranslateAction collectionSlug="lessons" />
export const TranslateExerciseAction: React.FC = () => (
  <TranslateAction collectionSlug="exercises" />
)
