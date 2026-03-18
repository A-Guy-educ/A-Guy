'use client'

import React from 'react'
import type { TranslationStatus } from './useTranslation'

interface TranslationStatusBannerProps {
  status: TranslationStatus
  error: string | null
  newDocId?: string
  collection?: string
  onReset: () => void
}

export const TranslationStatusBanner: React.FC<TranslationStatusBannerProps> = ({
  status,
  error,
  newDocId,
  collection,
  onReset,
}) => {
  if (status === 'idle') return null

  if (status === 'loading') {
    return (
      <div className="mt-3 rounded-md bg-blue-50 p-3 text-sm text-blue-700">
        Translating content... This may take a moment.
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
        <p>{error || 'Translation failed'}</p>
        <button type="button" onClick={onReset} className="mt-2 underline text-red-600">
          Try again
        </button>
      </div>
    )
  }

  if (status === 'success' && newDocId && collection) {
    return (
      <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">
        <p>Translation created successfully!</p>
        <a
          href={`/admin/collections/${collection}/${newDocId}`}
          className="mt-2 inline-block underline text-green-600 font-medium"
        >
          Go to translated document
        </a>
      </div>
    )
  }

  return null
}
