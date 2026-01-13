'use client'

import React from 'react'
import { cn } from '@/utilities/ui'
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

  if (!pdfUrl) {
    return null
  }

  const viewerUrl = `/pdfjs/viewer.html?file=${encodeURIComponent(pdfUrl)}`

  return (
    <div className={cn('w-full', className)}>
      <iframe
        src={viewerUrl}
        className="w-full h-[800px] border rounded-lg bg-muted/30"
        title="PDF Viewer"
      />
    </div>
  )
}
