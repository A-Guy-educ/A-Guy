'use client'

import React, { useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useTranslation } from './useTranslation'
import { TranslationStatusBanner } from './TranslationStatusBanner'
import { TranslationModal } from './TranslationModal'

export const TranslateCourseButton: React.FC = () => {
  const { id } = useDocumentInfo()
  const localeField = useFormFields(([fields]) => fields.locale)
  const currentLocale = (localeField?.value as string) || 'he'
  const targetLocale = currentLocale === 'he' ? 'en' : 'he'

  const [showModal, setShowModal] = useState(false)
  const { status, error, result, translate, reset } = useTranslation()

  if (!id) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Save the course first to enable translation.
      </div>
    )
  }

  const handleTranslate = (promptId?: string) => {
    translate({
      scope: 'course',
      courseId: id,
      targetLocale,
      promptId,
    })
    setShowModal(false)
  }

  const newCourseId = result?.id ?? (result as unknown as { courseId?: string })?.courseId

  return (
    <div className="p-4">
      <p className="text-sm font-medium mb-2">Create Translated Version</p>
      <p className="text-xs text-muted-foreground mb-3">
        Clone entire course tree to <strong>{targetLocale === 'en' ? 'English' : 'Hebrew'}</strong>
      </p>

      {status === 'idle' && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Translate Whole Course
        </button>
      )}

      <TranslationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleTranslate}
        targetLocale={targetLocale}
        scope="Course"
        isTranslating={status === 'loading'}
      />

      <TranslationStatusBanner
        status={status}
        error={error}
        newDocId={newCourseId}
        collection="courses"
        onReset={() => {
          reset()
          setShowModal(false)
        }}
      />
    </div>
  )
}
