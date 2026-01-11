'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

export const AudioPreview: React.FC = () => {
  const urlField = useFormFields(([fields]) => fields.url)
  const filenameField = useFormFields(([fields]) => fields.filename)

  const url = urlField?.value as string | undefined
  const filename = filenameField?.value as string | undefined

  if (!url) {
    return (
      <div className="p-4">
        <p>No audio uploaded yet</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <audio controls className="w-full">
        <source src={url} />
        Your browser does not support the audio tag.
      </audio>
      {filename && <p className="mt-2 text-sm text-muted-foreground">{filename}</p>}
    </div>
  )
}
