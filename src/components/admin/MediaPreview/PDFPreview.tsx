'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'
import { PDFViewer } from '@/components/Media/PDFMedia/PDFViewer'

export const PDFPreview: React.FC = () => {
  const urlField = useFormFields(([fields]) => fields.url)

  const url = urlField?.value as string | undefined

  if (!url) {
    return (
      <div className="p-4">
        <p>No PDF uploaded yet</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="h-[600px] border border-[var(--theme-elevation-300)] rounded overflow-hidden">
        <PDFViewer file={url} />
      </div>
    </div>
  )
}
