'use client'

import React, { useMemo } from 'react'
import type { Props as MediaProps } from '../types'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { cn } from '@/utilities/ui'

export const PDFViewerFull: React.FC<MediaProps> = (props) => {
  const { resource, className } = props

  // Get PDF URL
  const pdfUrl = useMemo(() => {
    if (resource && typeof resource === 'object') {
      const { filename, url } = resource
      return url ? getMediaUrl(url) : filename ? getMediaUrl(`/media/${filename}`) : null
    }
    if (typeof resource === 'string') {
      return getMediaUrl(resource)
    }
    return null
  }, [resource])

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-[841px] border rounded-lg bg-muted/30">
        <div className="text-muted-foreground">No PDF URL provided</div>
      </div>
    )
  }

  // Construct viewer URL with the PDF file parameter
  const viewerUrl = `/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`

  return (
    <div className={cn('w-full h-full min-h-[841px]', className)} dir="ltr">
      <iframe
        src={viewerUrl}
        className="w-full h-full border-0"
        title="PDF Viewer"
        style={{ minHeight: '841px' }}
      />
    </div>
  )
}
