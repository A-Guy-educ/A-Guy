'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'
import { getMediaUrl } from '@/infra/utils/getMediaUrl'
import { getYouTubeEmbedUrl } from '@/infra/media/youtube'
import type { Media } from '@/payload-types'
import { useMediaMap } from '../../context/MediaMapContext'

interface MediaAttachmentsProps {
  mediaIds: string[] | undefined
  className?: string
}

function isImageType(media: Media): boolean {
  return media.type === 'image' || media.type === 'svg'
}

function isVideoType(media: Media): boolean {
  return media.type === 'video'
}

function isExternalType(media: Media): boolean {
  return media.type === 'external'
}

/**
 * Renders a single media item.
 * Uses plain <img> / <video> to avoid Next.js Image optimization domain issues.
 */
function MediaItem({ media }: { media: Media }) {
  // External media has no uploaded file — handle before getMediaUrl
  if (isExternalType(media)) {
    const externalUrl = media.externalUrl
    if (!externalUrl) return null

    const youTubeEmbedUrl = getYouTubeEmbedUrl(externalUrl)

    if (youTubeEmbedUrl) {
      return (
        <div className="relative w-full overflow-hidden" style={{ paddingTop: '56.25%' }}>
          <iframe
            src={youTubeEmbedUrl}
            className="absolute inset-0 h-full w-full border-0"
            title="YouTube video"
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          />
        </div>
      )
    }

    return (
      <iframe src={externalUrl} className="h-[400px] w-full border-0" title="External content" />
    )
  }

  const src = getMediaUrl(media.url, media.updatedAt)

  if (!src) return null

  if (isVideoType(media)) {
    return (
      <video controls playsInline className="w-full max-h-96">
        <source src={src} type={media.mimeType || undefined} />
      </video>
    )
  }

  if (isImageType(media)) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={src} alt={media.alt || ''} className="w-full h-auto max-h-96 object-contain" />
    )
  }

  // Fallback for other types — render as image if URL exists
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={media.alt || media.filename || ''}
      className="w-full h-auto max-h-96 object-contain"
    />
  )
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
          className="rounded-xl overflow-hidden border border-border/60 bg-muted/30 flex items-center justify-center"
        >
          <MediaItem media={media} />
        </div>
      ))}
    </div>
  )
}
