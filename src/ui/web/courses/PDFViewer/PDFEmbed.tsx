'use client'

import { useState, useRef, useEffect } from 'react'

interface PDFEmbedProps {
  pdfUrl: string
  title: string
}

export function PDFEmbed({ pdfUrl, title }: PDFEmbedProps) {
  const [showFallback, setShowFallback] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fallbackShownRef = useRef(false)

  const handleLoad = () => {
    // Clear the timeout since load succeeded
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = null
    }

    // Check if iframe actually loaded meaningful content
    const iframe = iframeRef.current
    if (iframe && iframe.contentWindow) {
      try {
        // Try to access iframe content - will throw if cross-origin blocked
        const doc = iframe.contentWindow.document
        const bodyContent = doc.body?.innerHTML || ''
        // If body is empty or shows about:blank, assume blocked
        if (!bodyContent || bodyContent.includes('about:blank')) {
          fallbackShownRef.current = true
          setShowFallback(true)
        }
        // If content looks like error page, show fallback
        if (bodyContent.includes('X-Frame-Options') || bodyContent.includes('Refused')) {
          fallbackShownRef.current = true
          setShowFallback(true)
        }
      } catch {
        // Cross-origin access denied - iframe is blocked
        fallbackShownRef.current = true
        setShowFallback(true)
      }
    }
  }

  const handleError = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = null
    }
    if (!fallbackShownRef.current) {
      fallbackShownRef.current = true
      setShowFallback(true)
    }
  }

  // Set a timeout to detect if iframe doesn't load within reasonable time
  useEffect(() => {
    // Reset state when URL changes
    setShowFallback(false)
    fallbackShownRef.current = false

    // Set timeout to detect blocking (if iframe hasn't loaded by then)
    loadTimeoutRef.current = setTimeout(() => {
      // Only show fallback if not already showing it
      if (!fallbackShownRef.current) {
        fallbackShownRef.current = true
        setShowFallback(true)
      }
    }, 3000) // 3 seconds should be enough for PDF to start loading

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
      }
    }
  }, [pdfUrl])

  if (showFallback) {
    return (
      <div className="border rounded-lg overflow-hidden bg-gray-50 p-6">
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <p className="text-muted-foreground mb-3">
            PDF cannot be displayed inline due to browser restrictions.
          </p>
          <a
            href={pdfUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download PDF
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-gray-50 relative">
      {/* Overlay to hide the top toolbar - covers approximately 40px from top */}
      <iframe
        ref={iframeRef}
        src={pdfUrl}
        title={`PDF: ${title}`}
        className="w-full relative"
        style={{ height: '841px', marginTop: '-41px' }}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  )
}
