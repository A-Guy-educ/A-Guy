'use client'

import React, { useState, useRef } from 'react'
import {
  PdfLoader,
  PdfHighlighter,
  type Highlight,
  type PdfHighlighterUtils,
  AreaHighlight,
  TextHighlight,
  DrawingHighlight,
  ImageHighlight,
  FreetextHighlight,
  ShapeHighlight,
  LeftPanel,
  useHighlightContainerContext,
} from 'react-pdf-highlighter-plus'
import 'react-pdf-highlighter-plus/style/style.css'
import type { Props as MediaProps } from '../types'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { cn } from '@/utilities/ui'

export const PDFViewerWithAnnotations: React.FC<MediaProps> = (props) => {
  const { resource, className } = props
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [error, setError] = useState<string | null>(null)
  const [drawingMode, setDrawingMode] = useState(false)
  const [drawingColor, setDrawingColor] = useState('#FF6B6B')
  const [drawingWidth, setDrawingWidth] = useState(3)
  const highlighterUtilsRef = useRef<PdfHighlighterUtils | undefined>(undefined)

  // Get PDF URL
  const pdfUrl = React.useMemo(() => {
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-[841px] border rounded-lg bg-muted/30">
        <div className="text-destructive">Error loading PDF: {error}</div>
      </div>
    )
  }

  const handleDeleteHighlight = (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id))
  }

  const handleDrawingComplete = (position: any, dataUrl: string) => {
    const newHighlight: Highlight = {
      id: String(Date.now()),
      type: 'drawing',
      position,
      content: { image: dataUrl },
    }
    setHighlights((prev) => [...prev, newHighlight])
    setDrawingMode(false)
  }

  return (
    <div className={cn('flex flex-col h-full min-h-[841px]', className)} dir="ltr">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b bg-background/95 backdrop-blur shrink-0">
        <button
          onClick={() => setDrawingMode(!drawingMode)}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            drawingMode
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80',
          )}
        >
          {drawingMode ? '✓ Drawing' : 'Draw'}
        </button>

        {drawingMode && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-sm">Color:</label>
              <input
                type="color"
                value={drawingColor}
                onChange={(e) => setDrawingColor(e.target.value)}
                className="w-10 h-8 rounded border cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm">Width:</label>
              <input
                type="range"
                min="1"
                max="10"
                value={drawingWidth}
                onChange={(e) => setDrawingWidth(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm w-6">{drawingWidth}</span>
            </div>
          </>
        )}

        <div className="flex-1" />

        <span className="text-sm text-muted-foreground">
          {highlights.length} annotation{highlights.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* PDF Viewer Container - Must be relative positioned with flex-1 */}
      <div className="relative flex-1">
        <PdfLoader
          document={pdfUrl}
          onError={(err) => {
            console.error('[PDFViewerWithAnnotations] Error:', err)
            setError(err instanceof Error ? err.message : String(err))
          }}
        >
          {(pdfDocument) => {
            console.log('[PDFViewerWithAnnotations] PDF loaded:', pdfDocument.numPages, 'pages')
            return (
              <PdfHighlighter
                pdfDocument={pdfDocument}
                highlights={highlights}
                enableAreaSelection={(e) => e.altKey}
                enableDrawingCreation={() => drawingMode}
                onDrawingComplete={handleDrawingComplete}
                drawingConfig={{
                  strokeColor: drawingColor,
                  strokeWidth: drawingWidth,
                }}
                utilsRef={(utils) => {
                  highlighterUtilsRef.current = utils
                }}
              >
                <LeftPanel pdfDocument={pdfDocument} />
                <HighlightContainer onDelete={handleDeleteHighlight} />
              </PdfHighlighter>
            )
          }}
        </PdfLoader>
      </div>
    </div>
  )
}

interface HighlightContainerProps {
  onDelete: (id: string) => void
}

function HighlightContainer({ onDelete }: HighlightContainerProps) {
  const { highlight, isScrolledTo } = useHighlightContainerContext()

  const renderHighlight = () => {
    switch (highlight.type) {
      case 'text':
        return <TextHighlight highlight={highlight} isScrolledTo={isScrolledTo} />
      case 'area':
        return <AreaHighlight highlight={highlight} isScrolledTo={isScrolledTo} />
      case 'drawing':
        return <DrawingHighlight highlight={highlight} isScrolledTo={isScrolledTo} />
      case 'image':
        return <ImageHighlight highlight={highlight} isScrolledTo={isScrolledTo} />
      case 'freetext':
        return <FreetextHighlight highlight={highlight} isScrolledTo={isScrolledTo} />
      case 'shape':
        return <ShapeHighlight highlight={highlight} isScrolledTo={isScrolledTo} />
      default:
        return null
    }
  }

  return (
    <div className="relative">
      {renderHighlight()}
      {highlight.id && (
        <button
          onClick={() => onDelete(highlight.id)}
          className="absolute top-0 right-0 px-2 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
          style={{ transform: 'translate(50%, -50%)' }}
        >
          ×
        </button>
      )}
    </div>
  )
}
