'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

export const PDFPreview: React.FC = () => {
  const urlField = useFormFields(([fields]) => fields.url)
  const filenameField = useFormFields(([fields]) => fields.filename)

  const url = urlField?.value as string | undefined
  const filename = filenameField?.value as string | undefined

  if (!url) {
    return (
      <div className="p-4">
        <p>No PDF uploaded yet</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-[var(--theme-elevation-300)] rounded no-underline"
        >
          📄 Open PDF
        </a>
      </div>
      <iframe
        src={url}
        className="w-full h-[600px] border border-[var(--theme-elevation-300)] rounded"
        title={filename || 'PDF Preview'}
      />
    </div>
  )
}
