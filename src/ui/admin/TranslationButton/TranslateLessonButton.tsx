'use client'

import React, { useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useTranslation } from './useTranslation'
import { TranslationStatusBanner } from './TranslationStatusBanner'

export const TranslateLessonButton: React.FC = () => {
  const { id } = useDocumentInfo()
  const localeField = useFormFields(([fields]) => fields.locale)
  const currentLocale = (localeField?.value as string) || 'he'
  const targetLocale = currentLocale === 'he' ? 'en' : 'he'

  const [targetChapterId, setTargetChapterId] = useState('')
  const [includeExercises, setIncludeExercises] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const { status, error, result, translate, reset } = useTranslation()

  if (!id) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Save the lesson first to enable translation.
      </div>
    )
  }

  const handleTranslate = () => {
    if (!targetChapterId.trim()) return
    translate({
      scope: 'lesson',
      lessonId: id,
      targetLocale,
      targetChapterId: targetChapterId.trim(),
      includeExercises,
    })
  }

  const newLessonId = result?.id ?? (result as unknown as { lessonId?: string })?.lessonId

  return (
    <div className="p-4">
      <p className="text-sm font-medium mb-2">Create Translated Version</p>
      <p className="text-xs text-muted-foreground mb-3">
        Clone this lesson and translate to{' '}
        <strong>{targetLocale === 'en' ? 'English' : 'Hebrew'}</strong>
      </p>

      {!showForm && status === 'idle' && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Translate to {targetLocale.toUpperCase()}
        </button>
      )}

      {showForm && status === 'idle' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium">
            Target Chapter ID
            <input
              type="text"
              value={targetChapterId}
              onChange={(e) => setTargetChapterId(e.target.value)}
              placeholder="Paste chapter ID here"
              className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={includeExercises}
              onChange={(e) => setIncludeExercises(e.target.checked)}
              className="rounded border-input"
            />
            Include child exercises
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTranslate}
              disabled={!targetChapterId.trim()}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Translate
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
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
        newDocId={newLessonId}
        collection="lessons"
        onReset={() => {
          reset()
          setShowForm(true)
        }}
      />

      {status === 'success' && result?.exercises && result.exercises.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          {result.exercises.length} exercise(s) translated
        </div>
      )}
    </div>
  )
}
