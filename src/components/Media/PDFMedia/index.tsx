'use client'

import React, { useEffect } from 'react'
import { cn } from '@/utilities/ui'
import type { Props as MediaProps } from '../types'
import { useAnalytics } from '@/lib/analytics/providers/AnalyticsProvider'
import { PRODUCT_EVENTS } from '@/lib/analytics/contracts/events'

export const PDFMedia: React.FC<MediaProps> = (props) => {
  const { resource, className } = props
  const analytics = useAnalytics()

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
    if (resource && typeof resource === 'object' && resource.id) {
      analytics.track(PRODUCT_EVENTS.PDF_VIEWED, {
        document_id: resource.id,
        page_count:
          typeof resource === 'object' && 'pageCount' in resource
            ? Number(resource.pageCount)
            : undefined,
        file_name:
          typeof resource === 'object' && 'filename' in resource
            ? String(resource.filename)
            : undefined,
      })
    }
  }, [resource, analytics])

  if (!pdfUrl) {
    return null
  }

  // Load PDF.js viewer via proxy (Blob CDN sets Content-Disposition: attachment)
  // Add version parameter to bust cache when viewer files are updated
  // Add annotationEditorMode=15 to enable highlight tool
  const viewerUrl = `/api/pdfjs-viewer?file=${encodeURIComponent(pdfUrl)}&v=4.4.168&annotationEditorMode=15`

  return (
    <div className={cn('w-full h-full', className)}>
      <iframe src={viewerUrl} className="w-full h-full border-0" title="PDF Viewer" />
    </div>
  )
}
