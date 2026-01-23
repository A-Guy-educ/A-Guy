'use client'

import dynamic from 'next/dynamic'
import React from 'react'
import { useFormFields } from '@payloadcms/ui'
import type { Media } from '@/payload-types'

// Dynamically import PDFMedia with ssr: false to prevent server-side rendering
const PDFMedia = dynamic(() => import('@/ui/web/media/PDFMedia').then((mod) => mod.PDFMedia), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-8">
      <div className="text-muted-foreground">Loading PDF viewer...</div>
    </div>
  ),
})

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
