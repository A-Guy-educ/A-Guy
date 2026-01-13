'use client'

import { cn } from '@/utilities/ui'
import React, { useMemo } from 'react'

import type { Props as MediaProps } from '../types'

import { getMediaUrl } from '@/utilities/getMediaUrl'
import { PDFViewer } from './PDFViewer'

export const PDFMedia: React.FC<MediaProps> = (props) => {
  const { resource, className, page = 1 } = props

  // Get base PDF URL
  const pdfUrl = useMemo(() => {
    if (resource && typeof resource === 'object') {
      const { filename, url } = resource
      return url ? getMediaUrl(url) : filename ? getMediaUrl(`/media/${filename}`) : null
    }
    return null
  }, [resource])

  if (!pdfUrl || !resource || typeof resource !== 'object') {
    return null
  }

  return (
    <div className={cn('w-full h-full min-h-[600px]', className)}>
      <PDFViewer file={pdfUrl} initialPage={page} />
    </div>
  )
}
