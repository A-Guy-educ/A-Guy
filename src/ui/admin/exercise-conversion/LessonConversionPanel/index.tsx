'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import { ConvertContextButton } from '../ConvertContextButton'

interface MediaItem {
  id: string
  filename?: string
  mimeType?: string
}

export const LessonConversionPanel = () => {
  const { id: lessonId, lastUpdateTime } = useDocumentInfo()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentFilesField = useFormFields(([fields]: any[]) => fields?.contentFiles)
  const contentFilesValue = contentFilesField?.value

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
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
          cache: 'no-store',
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
  }, [contentFilesValue, lessonId, lastUpdateTime])

  // PDFs and images are the only types Convert Context handles today.
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
    return null // No PDFs or images — nothing to show
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
              <ConvertContextButton
                lessonId={String(lessonId)}
                mediaId={file.id}
                filename={String(file.filename || file.id)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default LessonConversionPanel
