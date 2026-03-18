'use client'

import React, { useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useTranslation } from './useTranslation'
import { TranslationStatusBanner } from './TranslationStatusBanner'

export const TranslateCourseButton: React.FC = () => {
  const { id } = useDocumentInfo()
  const localeField = useFormFields(([fields]) => fields.locale)
  const currentLocale = (localeField?.value as string) || 'he'
  const targetLocale = currentLocale === 'he' ? 'en' : 'he'

  const [showConfirm, setShowConfirm] = useState(false)
  const { status, error, result, translate, reset } = useTranslation()

  if (!id) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Save the course first to enable translation.
      </div>
    )
  }

  const handleTranslate = () => {
    translate({
      scope: 'course',
      courseId: id,
      targetLocale,
    })
    setShowConfirm(false)
  }

  const newCourseId = result?.id ?? (result as unknown as { courseId?: string })?.courseId

  return (
    <div className="p-4">
      <p className="text-sm font-medium mb-2">Create Translated Version</p>
      <p className="text-xs text-muted-foreground mb-3">
        Clone entire course tree to <strong>{targetLocale === 'en' ? 'English' : 'Hebrew'}</strong>
      </p>

      {!showConfirm && status === 'idle' && (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Translate Whole Course
        </button>
      )}

      {showConfirm && status === 'idle' && (
        <div className="space-y-2">
          <p className="text-xs text-amber-600 font-medium">
            This will translate all chapters, lessons, and exercises. It may take several minutes.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTranslate}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
            >
              Confirm Translation
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="px-3 py-1.5 bg-muted text-muted-foreground rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <TranslationStatusBanner
        status={status}
        error={error}
        newDocId={newCourseId}
        collection="courses"
        onReset={() => {
          reset()
          setShowConfirm(false)
        }}
      />
    </div>
  )
}
