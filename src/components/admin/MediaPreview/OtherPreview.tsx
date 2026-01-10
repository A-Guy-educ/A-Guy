'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

export const OtherPreview: React.FC = () => {
  const filenameField = useFormFields(([fields]) => fields.filename)
  const filesizeField = useFormFields(([fields]) => fields.filesize)
  const urlField = useFormFields(([fields]) => fields.url)

  const filename = filenameField?.value as string | undefined
  const filesize = filesizeField?.value as number | undefined
  const url = urlField?.value as string | undefined

  return (
    <div className="p-4">
      <h3 className="mb-2">File Preview (Download Only)</h3>
      <p className="mb-2">
        <strong>Filename:</strong> {filename || 'Unknown'}
      </p>
      {filesize && (
        <p className="mb-4 text-sm text-muted-foreground">
          <strong>Size:</strong> {Math.round(filesize / 1024)} KB
        </p>
      )}
      {url && (
        <a
          href={url}
          download
          className="inline-block px-4 py-2 bg-[var(--theme-elevation-300)] rounded no-underline"
        >
          📥 Download File
        </a>
      )}
    </div>
  )
}

