'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ConversionStatusPanel } from '../ConversionStatusPanel'
import { DraftExercisesList } from '../DraftExercisesList'

interface MediaItem {
  id: string
  filename?: string
  mimeType?: string
}

export const LessonConversionPanel = () => {
  const { id: lessonId } = useDocumentInfo()
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentFilesField = useFormFields(([fields]: any[]) => fields?.contentFiles)
  const contentFilesValue = contentFilesField?.value

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedPdf, setExpandedPdf] = useState<string | null>(null)

  // Resolve media IDs to full objects
  useEffect(() => {
    async function resolveMedia() {
      const value = contentFilesValue
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
  }, [contentFilesValue])

  // Filter for PDFs only
  const pdfFiles = mediaItems.filter((m) => m.mimeType === 'application/pdf')

  if (!lessonId) {
    return null // Don't show on create form
  }

  if (isLoading) {
    return (
      <div
        style={{
          padding: 12,
          border: '1px solid var(--theme-elevation-200)',
          borderRadius: 4,
          backgroundColor: 'var(--theme-elevation-50)',
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--theme-elevation-1000)',
            marginBottom: 4,
          }}
        >
          Exercise Conversion
        </h3>
        <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>Loading...</p>
      </div>
    )
  }

  if (pdfFiles.length === 0) {
    return (
      <div
        style={{
          padding: 12,
          border: '1px solid var(--theme-elevation-200)',
          borderRadius: 4,
          backgroundColor: 'var(--theme-elevation-50)',
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--theme-elevation-1000)',
            marginBottom: 4,
          }}
        >
          Exercise Conversion
        </h3>
        <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>No PDFs attached.</p>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 12,
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 4,
        backgroundColor: 'var(--theme-elevation-50)',
      }}
    >
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--theme-elevation-1000)',
          marginBottom: 8,
        }}
      >
        Exercise Conversion
      </h3>

      {pdfFiles.map((pdf) => (
        <div
          key={pdf.id}
          style={{
            marginBottom: 8,
            padding: 8,
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: 4,
            backgroundColor: 'var(--theme-elevation-0)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--theme-elevation-600)',
              }}
            >
              PDF
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--theme-elevation-1000)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pdf.filename || pdf.id}
            </span>
            <button
              onClick={() =>
                router.push(`/admin/conversion-jobs/new?lessonId=${lessonId}&mediaId=${pdf.id}`)
              }
              style={{
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 500,
                border: 'none',
                borderRadius: 3,
                backgroundColor: 'var(--theme-elevation-900)',
                color: 'var(--theme-elevation-0)',
                cursor: 'pointer',
              }}
            >
              Convert
            </button>
          </div>

          {/* Status Panel */}
          <div style={{ marginTop: 4 }}>
            <ConversionStatusPanel
              lessonId={String(lessonId)}
              mediaId={pdf.id}
              onViewExercises={() => setExpandedPdf(expandedPdf === pdf.id ? null : pdf.id)}
            />
          </div>

          {/* Draft Exercises */}
          {expandedPdf === pdf.id && (
            <div style={{ marginTop: 4 }}>
              <DraftExercisesList lessonId={String(lessonId)} sourceDocId={pdf.id} />
            </div>
          )}
        </div>
      ))}

      {/* Link to full dashboard */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 8,
          borderTop: '1px solid var(--theme-elevation-200)',
        }}
      >
        <a
          href={`/admin/conversion-jobs?lessonId=${lessonId}`}
          style={{
            fontSize: 11,
            color: 'var(--theme-elevation-700)',
            textDecoration: 'none',
          }}
        >
          View all conversion jobs →
        </a>
      </div>
    </div>
  )
}

export default LessonConversionPanel
