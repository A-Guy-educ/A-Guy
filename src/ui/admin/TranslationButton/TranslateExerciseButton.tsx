'use client'

import React, { useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useTranslation } from './useTranslation'
import { TranslationStatusBanner } from './TranslationStatusBanner'
import { TranslationModal } from './TranslationModal'

export const TranslateExerciseButton: React.FC = () => {
  const { id } = useDocumentInfo()
  const localeField = useFormFields(([fields]) => fields.locale)
  const currentLocale = (localeField?.value as string) || 'he'
  const targetLocale = currentLocale === 'he' ? 'en' : 'he'

  const [targetLessonId, setTargetLessonId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const { status, error, result, translate, reset } = useTranslation()

  if (!id) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Save the exercise first to enable translation.
      </div>
    )
  }

  const handleTranslate = (promptId?: string) => {
    if (!targetLessonId.trim()) return
    translate({
      scope: 'exercise',
      exerciseId: id,
      targetLocale,
      targetLessonId: targetLessonId.trim(),
      promptId,
    })
    setShowModal(false)
  }

  return (
    <div className="p-4">
      <p className="text-sm font-medium mb-2">Create Translated Version</p>
      <p className="text-xs text-muted-foreground mb-3">
        Clone this exercise and translate to{' '}
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
            Target Lesson ID
            <input
              type="text"
              value={targetLessonId}
              onChange={(e) => setTargetLessonId(e.target.value)}
              placeholder="Paste lesson ID here"
              className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              disabled={!targetLessonId.trim()}
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

      <TranslationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleTranslate}
        targetLocale={targetLocale}
        scope="Exercise"
        isTranslating={status === 'loading'}
      />

      <TranslationStatusBanner
        status={status}
        error={error}
        newDocId={result?.id}
        collection="exercises"
        onReset={() => {
          reset()
          setShowForm(true)
        }}
      />
    </div>
  )
}
