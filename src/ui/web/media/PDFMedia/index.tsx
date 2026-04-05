'use client'

import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { cn } from '@/infra/utils/ui'
import React, { useCallback, useEffect, useRef } from 'react'
import type { Props as MediaProps } from '../types'

/** Timeout (ms) to detect PDF iframe that never loads */
const PDF_LOAD_TIMEOUT_MS = 30_000

export const PDFMedia: React.FC<MediaProps> = (props) => {
  const { resource, className, lessonId, courseId } = props
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const loadedRef = useRef(false)

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
  }, [])

  const handleIframeError = useCallback(() => {
    if (!lessonId) return
    systemEventBus.emit(SYSTEM_EVENTS.LESSON_LOAD_FAILED, {
      lesson_id: lessonId,
      content_type: 'pdf' as const,
      error_type: '404' as const,
      error_message: 'PDF iframe failed to load',
      course_id: courseId,
    })
  }, [lessonId, courseId])

  if (!pdfUrl) {
    return null
  }

  // Load PDF.js viewer via proxy (Blob CDN sets Content-Disposition: attachment)
  // Add version parameter to bust cache when viewer files are updated
  const viewerUrl = `/api/pdfjs-viewer?file=${encodeURIComponent(pdfUrl)}&v=4.4.168`

  return (
    <div className={cn('w-full h-full min-h-0', className)}>
      <iframe
        ref={iframeRef}
        src={viewerUrl}
        className="w-full h-full border-0"
        title="PDF Viewer"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
      />
    </div>
  )
}
