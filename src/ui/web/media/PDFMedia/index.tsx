'use client'

import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { cn } from '@/infra/utils/ui'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Props as MediaProps } from '../types'

/** Timeout (ms) to detect PDF iframe that never loads */
const PDF_LOAD_TIMEOUT_MS = 30_000

export const PDFMedia: React.FC<MediaProps> = (props) => {
  const { resource, className, lessonId, courseId } = props
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const loadedRef = useRef(false)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

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

  // Track PDF load timeout
  useEffect(() => {
    if (!pdfUrl || !lessonId) return

    loadedRef.current = false

    const timer = setTimeout(() => {
      if (!loadedRef.current) {
        systemEventBus.emit(SYSTEM_EVENTS.LESSON_LOAD_FAILED, {
          lesson_id: lessonId,
          content_type: 'pdf' as const,
          error_type: 'timeout' as const,
          error_message: `PDF iframe did not load within ${PDF_LOAD_TIMEOUT_MS}ms`,
          course_id: courseId,
        })
      }
    }, PDF_LOAD_TIMEOUT_MS)

    return () => clearTimeout(timer)
  }, [pdfUrl, lessonId, courseId])

  const handleIframeLoad = useCallback(() => {
    loadedRef.current = true
    setHasError(false)
    setErrorMessage(null)
  }, [])

  const handleIframeError = useCallback(() => {
    if (!lessonId) return
    setHasError(true)
    setErrorMessage('Failed to load PDF. Please try again.')
    systemEventBus.emit(SYSTEM_EVENTS.LESSON_LOAD_FAILED, {
      lesson_id: lessonId,
      content_type: 'pdf' as const,
      error_type: '404' as const,
      error_message: 'PDF iframe failed to load',
      course_id: courseId,
    })
  }, [lessonId, courseId])

  const handleRetry = useCallback(() => {
    setHasError(false)
    setErrorMessage(null)
    setRetryKey((k) => k + 1)
  }, [])

  if (!pdfUrl) {
    return null
  }

  // Load PDF.js viewer via proxy (Blob CDN sets Content-Disposition: attachment)
  // Add version parameter to bust cache when viewer files are updated
  // Include retryKey to allow retrying on error
  const viewerUrl = `/api/pdfjs-viewer?file=${encodeURIComponent(pdfUrl)}&v=4.4.168&retry=${retryKey}`

  return (
    <div className={cn('w-full h-full min-h-0', className)}>
      {hasError ? (
        <div className="flex flex-col items-center justify-center h-full gap-content-gap text-center">
          <div className="flex flex-col gap-content-gap-xs">
            <p className="text-body-md text-text-secondary">
              {errorMessage || 'Failed to load PDF.'}
            </p>
            <button
              onClick={handleRetry}
              className="mx-auto px-4 py-2 bg-primary text-white rounded-button transition-all duration-normal hover:bg-primary/90"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : (
        <iframe
          key={retryKey}
          ref={iframeRef}
          src={viewerUrl}
          className="w-full h-full border-0"
          title="PDF Viewer"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      )}
    </div>
  )
}
