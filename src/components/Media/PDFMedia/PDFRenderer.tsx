'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { cn } from '@/utilities/ui'
import type { Props as MediaProps } from '../types'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { useI18n } from '@/providers/I18n'

export const PDFRenderer: React.FC<MediaProps> = (props) => {
  const { resource, className, page: initialPage = 1 } = props
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

  // Get PDF URL
  const pdfUrl = React.useMemo(() => {
    if (resource && typeof resource === 'object') {
      const { filename, url } = resource
      return url ? getMediaUrl(url) : filename ? getMediaUrl(`/media/${filename}`) : null
    }
    return null
  }, [resource])

  // Set worker source
  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
  }, [])

  // Load PDF document
  useEffect(() => {
    if (!pdfUrl) {
      setLoading(false)
      return
    }

    const loadPDF = async () => {
      try {
        setLoading(true)
        setError(null)

        const loadingTask = pdfjsLib.getDocument(pdfUrl)
        const pdf = await loadingTask.promise

        pdfDocRef.current = pdf
        setTotalPages(pdf.numPages)
        setLoading(false)
      } catch (err) {
        console.error('[PDFMedia] Error loading PDF:', err)
        setError(err instanceof Error ? err.message : 'Failed to load PDF')
        setLoading(false)
      }
    }

    loadPDF()

    return () => {
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy()
      }
    }
  }, [pdfUrl])

  // Render current page
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDocRef.current || !canvasRef.current || !containerRef.current) return

      try {
        const page = await pdfDocRef.current.getPage(currentPage)
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')

        if (!context) return

        // Get container width and calculate scale to fit
        const containerWidth = containerRef.current.offsetWidth
        const originalViewport = page.getViewport({ scale: 1 })
        const scale = Math.min(containerWidth / originalViewport.width, 1.5)

        const viewport = page.getViewport({ scale })
        const outputScale = window.devicePixelRatio || 1

        const canvasWidth = Math.floor(viewport.width * outputScale)
        const canvasHeight = Math.floor(viewport.height * outputScale)

        canvas.width = canvasWidth
        canvas.height = canvasHeight
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null

        await page.render({
          canvasContext: context,
          viewport,
          transform: transform ?? undefined,
        }).promise
      } catch (err) {
        console.error('[PDFMedia] Error rendering page:', err)
        setError(err instanceof Error ? err.message : 'Failed to render page')
      }
    }

    renderPage()
  }, [currentPage, totalPages])

  const goToPreviousPage = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  const goToNextPage = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
  }

  if (!pdfUrl) {
    return null
  }

  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center h-[841px] border rounded-lg bg-muted/30',
          className,
        )}
      >
        <div className="text-muted-foreground">{t('courses.loadingPdf')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center h-[841px] border rounded-lg bg-muted/30',
          className,
        )}
      >
        <div className="text-destructive">
          {t('courses.pdfError')}: {error}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div
        ref={containerRef}
        className="overflow-auto border rounded-lg bg-muted/30 p-4 flex justify-center"
      >
        <canvas ref={canvasRef} className="max-w-full" />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pb-4">
          <button
            type="button"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {t('courses.previousPage')}
          </button>

          <span className="text-sm text-muted-foreground min-w-[100px] text-center">
            {t('courses.pageOf')
              .replace('{{current}}', String(currentPage))
              .replace('{{total}}', String(totalPages))}
          </span>

          <button
            type="button"
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {t('courses.nextPage')}
          </button>
        </div>
      )}
    </div>
  )
}
