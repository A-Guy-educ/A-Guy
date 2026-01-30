'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React, { lazy, Suspense, useEffect, useState } from 'react'
import { ConversionStatusPanel } from '../ConversionStatusPanel'
import { DraftExercisesList } from '../DraftExercisesList'
import '../styles.css'

// Lazy load the ConvertModal component
const ConvertModal = lazy(() =>
  import('../ConvertModal').then((m) => ({ default: m.ConvertModal })),
)

interface MediaItem {
  id: string
  filename?: string
  mimeType?: string
}

interface LessonConversionPanelProps {
  // This is a UI field component - it doesn't receive props directly
  // but uses useDocumentInfo and useFormFields hooks
}

export const LessonConversionPanel: React.FC<LessonConversionPanelProps> = () => {
  const { id: lessonId } = useDocumentInfo()
  const contentFilesField = useFormFields(([fields]) => fields.contentFiles)

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [expandedPdf, setExpandedPdf] = useState<string | null>(null)

  // Resolve media IDs to full objects
  useEffect(() => {
    async function resolveMedia() {
      const value = contentFilesField?.value
      if (!value || !Array.isArray(value) || value.length === 0) {
        setMediaItems([])
        setIsLoading(false)
        return
      }

      // Check if we have full objects or just IDs
      const firstItem = value[0]
      if (typeof firstItem === 'object' && firstItem !== null && 'mimeType' in firstItem) {
        // Already have full objects
        setMediaItems(value as MediaItem[])
        setIsLoading(false)
        return
      }

      // Need to fetch media details
      try {
        const ids = value.map((v) => (typeof v === 'string' ? v : v.id)).join(',')
        const response = await fetch(
          `/api/media?where[id][in]=${encodeURIComponent(ids)}&limit=100`,
          { credentials: 'include' },
        )
        if (response.ok) {
          const data = await response.json()
          setMediaItems(data.docs || [])
        }
      } catch (err) {
        console.error('Failed to fetch media:', err)
      } finally {
        setIsLoading(false)
      }
    }

    resolveMedia()
  }, [contentFilesField?.value])

  // Filter for PDFs only
  const pdfFiles = mediaItems.filter((m) => m.mimeType === 'application/pdf')

  if (!lessonId) {
    return null // Don't show on create form
  }

  if (isLoading) {
    return (
      <div className="conversion-panel">
        <h3>Exercise Conversion</h3>
        <p>Loading media files...</p>
      </div>
    )
  }

  if (pdfFiles.length === 0) {
    return (
      <div className="conversion-panel">
        <h3>Exercise Conversion</h3>
        <p className="no-pdfs">No PDF files attached to this lesson.</p>
      </div>
    )
  }

  return (
    <div className="conversion-panel">
      <h3>Exercise Conversion</h3>

      {pdfFiles.map((pdf) => (
        <div key={pdf.id} className="pdf-section">
          <div className="pdf-header">
            <span className="pdf-icon">📄</span>
            <span className="pdf-filename">{pdf.filename || pdf.id}</span>
            <button
              className="btn btn-secondary convert-btn"
              onClick={() => setActiveModal(pdf.id)}
            >
              Convert → Exercises
            </button>
          </div>

          {/* Status Panel - always visible for this PDF */}
          <ConversionStatusPanel
            lessonId={String(lessonId)}
            mediaId={pdf.id}
            onViewExercises={() => setExpandedPdf(expandedPdf === pdf.id ? null : pdf.id)}
          />

          {/* Draft Exercises - expandable */}
          {expandedPdf === pdf.id && (
            <DraftExercisesList lessonId={String(lessonId)} sourceDocId={pdf.id} />
          )}

          {/* Convert Modal */}
          {activeModal === pdf.id && (
            <Suspense fallback={<div>Loading...</div>}>
              <ConvertModal
                lessonId={String(lessonId)}
                mediaId={pdf.id}
                filename={String(pdf.filename || pdf.id)}
                onClose={() => setActiveModal(null)}
              />
            </Suspense>
          )}
        </div>
      ))}
    </div>
  )
}

export default LessonConversionPanel
