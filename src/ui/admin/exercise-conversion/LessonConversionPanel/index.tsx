'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { Suspense, useEffect, useState } from 'react'
import { ConversionStatusPanel } from '../ConversionStatusPanel'
import { ConvertForm } from '../ConvertForm'
import { ConvertV2Button } from '../ConvertV2Button'
import { ConvertV3Button } from '../ConvertV3Button'
import { DraftExercisesList } from '../DraftExercisesList'
import { V2StatusPanel } from '../V2StatusPanel'
import { V3PreviewPanel } from '../V3PreviewPanel'

interface MediaItem {
  id: string
  filename?: string
  mimeType?: string
}

interface PreviewData {
  title: string
  draft: {
    title: string
    question: string
    options: string[]
    correctAnswer: number | null
    explanation?: string
    questionType: 'free_response' | 'true_false' | 'mcq'
  }
  content: {
    blocks: unknown[]
  }
  metadata: {
    model: string
    processingTimeMs: number
    promptId?: string
    promptVersion?: string
  }
  extractionLogId: string
}

export const LessonConversionPanel = () => {
  const { id: lessonId } = useDocumentInfo()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentFilesField = useFormFields(([fields]: any[]) => fields?.contentFiles)
  const contentFilesValue = contentFilesField?.value

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeForm, setActiveForm] = useState<string | null>(null)
  const [expandedPdf, setExpandedPdf] = useState<string | null>(null)
  const [v3Preview, setV3Preview] = useState<PreviewData | null>(null)
  const [v3MediaId, setV3MediaId] = useState<string | null>(null)
  const [needsSaveNotice, setNeedsSaveNotice] = useState(false)

  // Resolve media from persisted lesson data so conversion options always
  // match server-side validation (which checks lesson.contentFiles in the database).
  useEffect(() => {
    async function resolveMedia() {
      if (!lessonId) {
        setMediaItems([])
        setNeedsSaveNotice(false)
        setIsLoading(false)
        return
      }

      try {
        const lessonResponse = await fetch(`/api/lessons/${lessonId}?depth=1`, {
          credentials: 'include',
        })

        if (!lessonResponse.ok) {
          setMediaItems([])
          setNeedsSaveNotice(false)
          return
        }

        const lessonData = await lessonResponse.json()
        const persistedContentFiles = Array.isArray(lessonData?.contentFiles)
          ? lessonData.contentFiles
          : []

        const persistedIds = persistedContentFiles.map((item: string | { id: string }) =>
          typeof item === 'string' ? item : item.id,
        )

        const draftIds = Array.isArray(contentFilesValue)
          ? contentFilesValue.map((item: string | { id: string }) =>
              typeof item === 'string' ? item : item.id,
            )
          : []

        const hasUnsavedAttachmentChanges =
          draftIds.length !== persistedIds.length ||
          draftIds.some((id) => !persistedIds.includes(id))

        setNeedsSaveNotice(hasUnsavedAttachmentChanges)

        if (persistedContentFiles.length === 0) {
          setMediaItems([])
          return
        }

        const firstItem = persistedContentFiles[0]
        if (typeof firstItem === 'object' && firstItem !== null && 'mimeType' in firstItem) {
          setMediaItems(persistedContentFiles as MediaItem[])
          return
        }

        const ids = persistedIds.join(',')
        const mediaResponse = await fetch(
          `/api/media?where[id][in]=${encodeURIComponent(ids)}&limit=100`,
          {
            credentials: 'include',
          },
        )

        if (!mediaResponse.ok) {
          setMediaItems([])
          return
        }

        const mediaData = await mediaResponse.json()
        setMediaItems(mediaData.docs || [])
      } catch (err) {
        console.error('Failed to fetch media:', err)
      } finally {
        setIsLoading(false)
      }
    }

    resolveMedia()
  }, [contentFilesValue, lessonId])

  // Filter for PDFs and images (V3 supports both)
  const supportedFiles = mediaItems.filter(
    (m) => m.mimeType === 'application/pdf' || m.mimeType?.startsWith('image/'),
  )

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

  if (supportedFiles.length === 0) {
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
        <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          No PDFs or images attached.
        </p>
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

      {needsSaveNotice && (
        <p style={{ marginBottom: 8, fontSize: 11, color: 'var(--theme-warning-700)' }}>
          Save lesson changes to include newly attached files in conversion.
        </p>
      )}

      {supportedFiles.map((file) => (
        <div
          key={file.id}
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
              {file.mimeType?.startsWith('image/') ? 'IMG' : 'PDF'}
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
              {file.filename || file.id}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setActiveForm(activeForm === file.id ? null : file.id)}
                style={{
                  padding: '4px 12px',
                  fontSize: 11,
                  fontWeight: 500,
                  border: activeForm === file.id ? '1px solid var(--theme-elevation-200)' : 'none',
                  borderRadius: 3,
                  backgroundColor:
                    activeForm === file.id
                      ? 'var(--theme-elevation-100)'
                      : 'var(--theme-elevation-900)',
                  color:
                    activeForm === file.id
                      ? 'var(--theme-elevation-700)'
                      : 'var(--theme-elevation-0)',
                  cursor: 'pointer',
                }}
              >
                {activeForm === file.id ? 'Cancel' : 'Convert (V1)'}
              </button>
              <ConvertV2Button lessonId={String(lessonId)} mediaId={file.id} />
              <ConvertV3Button
                lessonId={String(lessonId)}
                mediaId={file.id}
                onPreview={(preview) => {
                  setV3Preview(preview)
                  setV3MediaId(file.id)
                }}
              />
            </div>
          </div>

          {/* Status Panel */}
          <div style={{ marginTop: 4 }}>
            <ConversionStatusPanel
              lessonId={String(lessonId)}
              mediaId={file.id}
              onViewExercises={() => setExpandedPdf(expandedPdf === file.id ? null : file.id)}
            />
          </div>

          {/* V2 Status Panel */}
          <div style={{ marginTop: 4 }}>
            <V2StatusPanel lessonId={String(lessonId)} mediaId={file.id} />
          </div>

          {/* Inline Convert Form */}
          {activeForm === file.id && (
            <Suspense
              fallback={
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--theme-elevation-500)' }}>
                  Loading...
                </div>
              }
            >
              <ConvertForm
                lessonId={String(lessonId)}
                mediaId={file.id}
                filename={String(file.filename || file.id)}
                onClose={() => setActiveForm(null)}
              />
            </Suspense>
          )}

          {/* V3 Preview Panel */}
          {v3Preview && v3MediaId === file.id && (
            <V3PreviewPanel
              preview={v3Preview}
              lessonId={String(lessonId)}
              mediaId={file.id}
              onClose={() => {
                setV3Preview(null)
                setV3MediaId(null)
              }}
              onCreated={() => {
                setV3Preview(null)
                setV3MediaId(null)
              }}
            />
          )}

          {/* Draft Exercises */}
          {expandedPdf === file.id && (
            <div style={{ marginTop: 4 }}>
              <DraftExercisesList lessonId={String(lessonId)} sourceDocId={file.id} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default LessonConversionPanel
