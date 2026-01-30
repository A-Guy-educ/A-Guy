'use client'

import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { cn } from '@/infra/utils/ui'
import React, { useEffect } from 'react'
import type { Props as MediaProps } from '../types'

export const PDFMedia: React.FC<MediaProps> = (props) => {
  const { resource, className } = props

  const pdfUrl = React.useMemo(() => {
    if (resource && typeof resource === 'object') {
      const { filename, url } = resource
      // Use relative URLs to avoid hydration mismatch with port numbers
      if (url) {
        // If URL is already absolute, return as-is, otherwise make it relative
        return url.startsWith('http://') || url.startsWith('https://') ? url : url
      }
      return filename ? `/media/${filename}` : null
    }
    return null
  }, [resource])

  // Track PDF viewed
  useEffect(() => {
    if (pdfUrl && resource && typeof resource === 'object') {
      systemEventBus.emit(SYSTEM_EVENTS.PDF_VIEWED, {
        pdf_url: pdfUrl,
        pdf_title: 'filename' in resource ? String(resource.filename) : undefined,
      })
    }
  }, [pdfUrl, resource])

  if (!pdfUrl) {
    return null
  }

  // Load PDF.js viewer via proxy (Blob CDN sets Content-Disposition: attachment)
  // Add version parameter to bust cache when viewer files are updated
  const viewerUrl = `/api/pdfjs-viewer?file=${encodeURIComponent(pdfUrl)}&v=4.4.168`

  return (
    <div className={cn('w-full h-full', className)}>
      <iframe src={viewerUrl} className="w-full h-full border-0" title="PDF Viewer" />
    </div>
  )
}
