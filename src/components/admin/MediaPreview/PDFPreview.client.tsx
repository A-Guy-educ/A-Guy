'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'
import { PDFMedia } from '@/components/Media/PDFMedia'
import type { Media } from '@/payload-types'

export const PDFPreviewClient: React.FC = () => {
  const urlField = useFormFields(([fields]) => fields.url)
  const url = urlField?.value as string | undefined

  if (!url) {
    return (
      <div className="p-4">
        <p>No PDF uploaded yet</p>
      </div>
    )
  }

  // Create minimal Media resource object for PDFMedia component
  const mediaResource: Partial<Media> = {
    url,
    filename: url.split('/').pop() || 'document.pdf',
    mimeType: 'application/pdf',
  }

  return (
    <div className="p-4 h-[500px]">
      <PDFMedia resource={mediaResource as Media} className="w-full h-full" />
    </div>
  )
}
