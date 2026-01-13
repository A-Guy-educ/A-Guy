'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Search, Download, Printer, Maximize, RotateCw } from 'lucide-react'
import { cn } from '@/utilities/ui'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure pdf.js worker
if (typeof window !== 'undefined') {
  // Use CDN for worker - stable version
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`
}

export interface PDFViewerProps {
  file: string | File | Blob | ArrayBuffer
  className?: string
  initialPage?: number
  onLoadSuccess?: (numPages: number) => void
  onLoadError?: (error: Error) => void
}

type Scale = number | 'auto' | 'page-width' | 'page-fit'

export const PDFViewer: React.FC<PDFViewerProps> = ({
  file,
  className,
  initialPage = 1,
  onLoadSuccess,
  onLoadError,
}) => {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(initialPage)
  const [scale, setScale] = useState<Scale>(1.0)
  const [rotation, setRotation] = useState<number>(0)
  const [searchText, setSearchText] = useState<string>('')
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const [containerHeight, setContainerHeight] = useState<number | null>(null)
  const pageContainerRef = React.useRef<HTMLDivElement>(null)

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages)
      setLoading(false)
      onLoadSuccess?.(numPages)
    },
    [onLoadSuccess]
  )

  const onDocumentLoadError = useCallback(
    (error: Error) => {
      setError(error.message)
      setLoading(false)
      onLoadError?.(error)
    },
    [onLoadError]
  )

  const goToPrevPage = useCallback(() => {
    setPageNumber((prev) => Math.max(1, prev - 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setPageNumber((prev) => Math.min(numPages, prev + 1))
  }, [numPages])

  const handlePageInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10)
      if (!isNaN(value) && value >= 1 && value <= numPages) {
        setPageNumber(value)
      }
    },
    [numPages]
  )

  const zoomIn = useCallback(() => {
    setScale((prev) => {
      if (typeof prev === 'number') {
        return Math.min(3.0, prev + 0.25)
      }
      return 1.25
    })
  }, [])

  const zoomOut = useCallback(() => {
    setScale((prev) => {
      if (typeof prev === 'number') {
        return Math.max(0.5, prev - 0.25)
      }
      return 0.75
    })
  }, [])

  const fitToWidth = useCallback(() => {
    setScale('page-width')
  }, [])

  const fitToPage = useCallback(() => {
    setScale('page-fit')
  }, [])

  // Calculate container dimensions for fit-to-width and fit-to-page
  useEffect(() => {
    const updateContainerDimensions = () => {
      if (pageContainerRef.current) {
        setContainerWidth(pageContainerRef.current.clientWidth - 32) // Account for padding
        setContainerHeight(pageContainerRef.current.clientHeight - 32) // Account for padding
      }
    }

    updateContainerDimensions()
    window.addEventListener('resize', updateContainerDimensions)
    return () => window.removeEventListener('resize', updateContainerDimensions)
  }, [])

  // Calculate scale for fit-to-page based on container and estimated page size
  // For fit-to-page, we'll use a calculated scale that fits both width and height
  const getFitToPageScale = useCallback((): number => {
    if (!containerWidth || !containerHeight) {
      return 1.0
    }
    // Estimate page dimensions (standard A4 is 595x842 points at 72 DPI)
    // We'll calculate based on container, assuming standard PDF aspect ratio
    const estimatedPageWidth = 595
    const estimatedPageHeight = 842
    const scaleX = (containerWidth - 32) / estimatedPageWidth
    const scaleY = (containerHeight - 32) / estimatedPageHeight
    return Math.min(scaleX, scaleY, 2.0) // Cap at 200% zoom
  }, [containerWidth, containerHeight])

  const rotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360)
  }, [])

  const handleDownload = useCallback(() => {
    if (typeof file === 'string') {
      const link = document.createElement('a')
      link.href = file
      link.download = 'document.pdf'
      link.click()
    }
  }, [file])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      const element = document.documentElement
      if (element.requestFullscreen) {
        element.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
    setIsFullscreen(!isFullscreen)
  }, [isFullscreen])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          goToPrevPage()
          break
        case 'ArrowRight':
          e.preventDefault()
          goToNextPage()
          break
        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomIn()
          }
          break
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomOut()
          }
          break
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            fitToWidth()
          }
          break
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            toggleFullscreen()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [goToPrevPage, goToNextPage, zoomIn, zoomOut, fitToWidth, toggleFullscreen])

  if (error) {
    return (
      <div className={cn('flex items-center justify-center p-8 bg-muted rounded', className)}>
        <div className="text-center">
          <p className="text-destructive mb-2">Error loading PDF</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-2 border-b bg-muted/50 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 px-2">
              <input
                type="number"
                min={1}
                max={numPages}
                value={pageNumber}
                onChange={handlePageInput}
                className="w-16 px-2 py-1 text-sm border rounded bg-background text-center"
              />
              <span className="text-sm text-muted-foreground">/ {numPages}</span>
            </div>
            <button
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={zoomOut}
              className="p-1.5 rounded hover:bg-muted"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm px-2 min-w-[60px] text-center">
              {typeof scale === 'number' ? `${Math.round(scale * 100)}%` : scale === 'page-width' ? 'Fit Width' : 'Fit Page'}
            </span>
            <button
              onClick={zoomIn}
              className="p-1.5 rounded hover:bg-muted"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* View Options */}
          <div className="flex items-center gap-1">
            <button
              onClick={fitToWidth}
              className="px-2 py-1 text-xs rounded hover:bg-muted"
              title="Fit to width (Ctrl+0)"
            >
              Fit Width
            </button>
            <button
              onClick={fitToPage}
              className="px-2 py-1 text-xs rounded hover:bg-muted"
              title="Fit to page"
            >
              Fit Page
            </button>
            <button
              onClick={rotate}
              className="p-1.5 rounded hover:bg-muted"
              aria-label="Rotate"
              title="Rotate 90°"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onFocus={() => setIsSearching(true)}
              onBlur={() => setIsSearching(false)}
              className="pl-8 pr-2 py-1 text-sm border rounded bg-background w-32"
            />
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Actions */}
          <button
            onClick={handleDownload}
            className="p-1.5 rounded hover:bg-muted"
            aria-label="Download"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handlePrint}
            className="p-1.5 rounded hover:bg-muted"
            aria-label="Print"
            title="Print PDF"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-muted"
            aria-label="Fullscreen"
            title="Toggle fullscreen (Ctrl+F)"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div
        ref={pageContainerRef}
        className="flex-1 overflow-auto bg-[#525659] flex items-center justify-center p-4"
      >
        {loading && (
          <div className="text-center text-white">
            <p>Loading PDF...</p>
          </div>
        )}
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="text-center text-white">
              <p>Loading PDF...</p>
            </div>
          }
          error={
            <div className="text-center text-white">
              <p>Failed to load PDF</p>
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={
              scale === 'page-width'
                ? undefined
                : scale === 'page-fit'
                  ? getFitToPageScale()
                  : typeof scale === 'number'
                    ? scale
                    : 1.0
            }
            width={
              scale === 'page-width' && containerWidth
                ? containerWidth
                : undefined
            }
            rotate={rotation}
            className="shadow-lg"
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  )
}
