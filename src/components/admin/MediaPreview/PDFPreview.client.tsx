'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useFormFields } from '@payloadcms/ui'
import * as pdfjsLib from 'pdfjs-dist'

export const PDFPreviewClient: React.FC = () => {
  const urlField = useFormFields(([fields]) => fields.url)
  const url = urlField?.value as string | undefined
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

  // Set worker source
  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
  }, [])

  useEffect(() => {
    if (!url) {
      setLoading(false)
      return
    }

    const loadPDF = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log('[PDFPreview] Starting PDF load for URL:', url)

        const loadingTask = pdfjsLib.getDocument(url)
        const pdf = await loadingTask.promise

        console.log('[PDFPreview] PDF loaded successfully, pages:', pdf.numPages)

        pdfDocRef.current = pdf
        setTotalPages(pdf.numPages)
        setLoading(false)
      } catch (err) {
        console.error('[PDFPreview] Error loading PDF:', err)
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
  }, [url])

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

  if (!url) {
    return (
      <div className="p-4">
        <p>No PDF uploaded yet</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading PDF...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-destructive">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div
        ref={containerRef}
        className="overflow-auto border border-border rounded-lg bg-muted/30 p-4 w-full flex justify-center"
      >
        <canvas ref={canvasRef} className="max-w-full h-auto" />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
          >
            Previous
          </button>

          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
