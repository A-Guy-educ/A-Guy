'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

export const DocumentPreview: React.FC = () => {
  const urlField = useFormFields(([fields]) => fields.url)
  const filenameField = useFormFields(([fields]) => fields.filename)
  const filesizeField = useFormFields(([fields]) => fields.filesize)

  const url = urlField?.value as string | undefined
  const filename = filenameField?.value as string | undefined
  const filesize = filesizeField?.value as number | undefined

  if (!url) {
    return (
      <div className="p-4">
        <p>No document uploaded yet</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h3 className="mb-2">Document Preview</h3>
      <p className="mb-2">
        <strong>Filename:</strong> {filename || 'Unknown'}
      </p>
      {filesize && (
        <p className="mb-4 text-sm text-muted-foreground">
          <strong>Size:</strong> {Math.round(filesize / 1024)} KB
        </p>
      )}
      <a
        href={url}
        download
        className="inline-block px-4 py-2 bg-[var(--theme-elevation-300)] rounded no-underline"
      >
        📄 Download Document
      </a>
    </div>
  )
}
