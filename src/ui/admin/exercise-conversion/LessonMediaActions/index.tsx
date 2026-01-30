'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'

interface LessonMediaActionsProps {
  media: {
    id: string
    filename: string
    mimeType: string
    filesize?: number
  }
  lessonId: string
}

export function LessonMediaActions({ media, lessonId }: LessonMediaActionsProps) {
  const { user } = useAuth()
  const isAdmin = user?.roles?.includes('admin')
  const isPdf = media.mimeType === 'application/pdf'

  if (!isAdmin || !isPdf) {
    return null
  }

  return (
    <div className="lesson-media-actions">
      <ConvertButton lessonId={lessonId} mediaId={media.id} filename={media.filename} />
    </div>
  )
}

function ConvertButton({
  lessonId,
  mediaId,
  filename,
}: {
  lessonId: string
  mediaId: string
  filename: string
}) {
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const ConvertModal = React.lazy(() =>
    import('@/ui/admin/exercise-conversion/ConvertModal').then((m) => ({
      default: m.ConvertModal,
    })),
  )

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setIsModalOpen(true)}>
        Convert → Exercises
      </button>

      {isModalOpen && (
        <React.Suspense fallback={<div>Loading...</div>}>
          <ConvertModal
            lessonId={lessonId}
            mediaId={mediaId}
            filename={filename}
            onClose={() => setIsModalOpen(false)}
          />
        </React.Suspense>
      )}
    </>
  )
}
