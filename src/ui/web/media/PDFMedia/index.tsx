'use client'

import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { cn } from '@/infra/utils/ui'
import React, { useEffect, useState } from 'react'
import type { Props as MediaProps } from '../types'

const MAX_RETRIES = 3

export const PDFMedia: React.FC<MediaProps> = (props) => {
  const { resource, className } = props
  const [retryCount, setRetryCount] = useState(0)
  const [hasError, setHasError] = useState(false)

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
        page_count: 'pageCount' in resource ? Number(resource.pageCount) : undefined,
      })
    }
  }, [pdfUrl, resource])

  // Listen for PDF load errors from the PDF.js viewer iframe
  // The viewer posts a "pdf-load-error" message when it fails to load the document
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'pdf-load-error') {
        setHasError(true)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Handle iframe error
  const handleIframeError = () => {
    setHasError(true)
  }

  // Handle retry
  const handleRetry = () => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount((prev) => prev + 1)
      setHasError(false)
    }
  }

  // Handle open in new tab (for permanent errors after max retries)
  const handleOpenInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank')
    }
  }

  if (!pdfUrl) {
    return null
  }

  // Load PDF.js viewer via proxy (Blob CDN sets Content-Disposition: attachment)
  // Add version parameter to bust cache when viewer files are updated
  // Add timestamp parameter to bust cache on retry
  const timestamp = Date.now()
  const viewerUrl = `/api/pdfjs-viewer?file=${encodeURIComponent(pdfUrl)}&v=4.4.168&t=${timestamp}`

  // Show error state after max retries
  if (hasError && retryCount >= MAX_RETRIES) {
    return (
      <div
        className={cn(
          'w-full h-full min-h-0 flex flex-col items-center justify-center bg-muted',
          className,
        )}
      >
        <div className="text-center p-4">
          <p className="text-lg font-medium text-foreground mb-2">Failed to load PDF</p>
          <p className="text-sm text-muted-foreground mb-4">
            The document could not be loaded after {MAX_RETRIES} attempts.
          </p>
          <button
            onClick={handleOpenInNewTab}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Open in new tab
          </button>
        </div>
      </div>
    )
  }

  // Show retry button on error
  if (hasError) {
    return (
      <div
        className={cn(
          'w-full h-full min-h-0 flex flex-col items-center justify-center bg-muted',
          className,
        )}
      >
        <div className="text-center p-4">
          <p className="text-lg font-medium text-foreground mb-2">Failed to load PDF</p>
          <p className="text-sm text-muted-foreground mb-4">
            Attempt {retryCount + 1} of {MAX_RETRIES}
          </p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('w-full h-full min-h-0', className)}>
      <iframe
        src={viewerUrl}
        className="w-full h-full border-0"
        title="PDF Viewer"
        onError={handleIframeError}
      />
    </div>
  )
}
