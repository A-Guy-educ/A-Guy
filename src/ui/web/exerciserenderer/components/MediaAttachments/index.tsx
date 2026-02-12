'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'
import { Media } from '@/ui/web/media'
import { useMediaMap } from '../../context/MediaMapContext'

interface MediaAttachmentsProps {
  mediaIds: string[] | undefined
  className?: string
}

/**
 * Renders media items attached to a content block via mediaIds.
 * Resolves IDs from the MediaMapContext provided at the ExerciseRenderer level.
 */
export function MediaAttachments({ mediaIds, className }: MediaAttachmentsProps) {
  const mediaMap = useMediaMap()

  if (!mediaIds || mediaIds.length === 0) return null

  const resolved = mediaIds
    .map((id) => mediaMap[id])
    .filter((m): m is NonNullable<typeof m> => Boolean(m))

  if (resolved.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-3 mt-3', className)}>
      {resolved.map((media) => (
        <div
          key={media.id}
          className="rounded-xl overflow-hidden border border-border/60 bg-muted/30"
        >
          <Media
            resource={media}
            imgClassName="w-full h-auto max-h-96 object-contain"
            videoClassName="w-full max-h-96"
            htmlElement="div"
            className="flex items-center justify-center"
          />
        </div>
      ))}
    </div>
  )
}
