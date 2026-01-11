'use client'

import { cn } from '@/utilities/ui'
import React, { useMemo } from 'react'

import type { Props as MediaProps } from '../types'

import { getMediaUrl } from '@/utilities/getMediaUrl'

export const PDFMedia: React.FC<MediaProps> = (props) => {
  const { resource, className, page = 1 } = props

  // Get base PDF URL
  const basePdfUrl = useMemo(() => {
    if (resource && typeof resource === 'object') {
      const { filename, url } = resource
      return url ? getMediaUrl(url) : filename ? getMediaUrl(`/media/${filename}`) : null
    }
    return null
  }, [resource])

  // Configure PDF.js viewer to hide toolbar and control view
  // Same configuration as old PDFViewer: page=${page}&pagemode=none&scrollbar=0&toolbar=0&navpanes=0&view=FitH
  const configuredPdfUrl = useMemo(() => {
    if (!basePdfUrl) return null

    // Check if pdfUrl already has hash parameters
    if (basePdfUrl.includes('#')) {
      return basePdfUrl
    }

    // Add hash parameters for single page mode with hidden toolbar
    const params = `page=${page}&pagemode=none&scrollbar=0&toolbar=0&navpanes=0&view=FitH`
    return `${basePdfUrl}#${params}`
  }, [basePdfUrl, page])

  const handleError = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const target = e.currentTarget
    target.classList.add('hidden')
  }

  if (!configuredPdfUrl || !resource || typeof resource !== 'object') {
    return null
  }

  return (
    <iframe
      src={configuredPdfUrl}
      title={
        typeof resource === 'object' && 'filename' in resource && resource.filename
          ? resource.filename
          : 'PDF'
      }
      className={cn('w-full h-[841px]', className)}
      loading="lazy"
      onError={handleError}
    />
  )
}
