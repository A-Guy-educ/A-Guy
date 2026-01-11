'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

export const ImagePreview: React.FC = () => {
  const urlField = useFormFields(([fields]) => fields.url)
  const altField = useFormFields(([fields]) => fields.alt)

  const url = urlField?.value as string | undefined
  const alt = altField?.value as string | undefined

  if (!url) {
    return (
      <div className="p-4">
        <p>No image uploaded yet</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <img src={url} alt={alt || 'Preview'} className="max-w-full h-auto rounded" />
    </div>
  )
}
