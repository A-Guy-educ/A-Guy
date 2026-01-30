'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { lazy, Suspense, useEffect, useState } from 'react'
import { ConversionStatusPanel } from '../ConversionStatusPanel'
import { DraftExercisesList } from '../DraftExercisesList'

// Lazy load the ConvertModal component
const ConvertModal = lazy(() =>
  import('../ConvertModal').then((m) => ({ default: m.ConvertModal })),
)

interface MediaItem {
  id: string
  filename?: string
  mimeType?: string
}

export const LessonConversionPanel = () => {
  const { id: lessonId } = useDocumentInfo()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentFilesField = useFormFields((context: any) => context.contentFiles)

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
      <div className="p-4 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold mb-2">Exercise Conversion</h3>
        <p>Loading media files...</p>
      </div>
    )
  }

  if (pdfFiles.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold mb-2">Exercise Conversion</h3>
        <p>No PDF files attached to this lesson.</p>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">Exercise Conversion</h3>

      {pdfFiles.map((pdf) => (
        <div key={pdf.id} className="mb-4 p-3 border rounded bg-white">
          <div className="flex items-center gap-2 mb-2">
            <span>📄</span>
            <span className="font-medium">{pdf.filename || pdf.id}</span>
            <button
              className="ml-auto px-3 py-1 bg-secondary text-secondary-foreground rounded"
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
