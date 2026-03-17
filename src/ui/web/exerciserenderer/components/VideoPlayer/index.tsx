'use client'

import React, { useState } from 'react'
import { cn } from '@/infra/utils/ui'
import { getMediaUrl } from '@/infra/utils/getMediaUrl'
import { useTranslations } from '@/ui/web/providers/I18n'

interface VideoPlayerProps {
  src?: string | null
  mimeType?: string | null
  className?: string
  /** Optional media object for additional metadata */
  media?: {
    url?: string | null
    mimeType?: string | null
    alt?: string | null
  }
}

/**
 * Determines if a mimeType represents a renderable video.
 * Per FR-005: Treat mimeType values starting with 'video/' as renderable.
 * If mimeType is missing or non-specific (e.g., 'application/octet-stream'), return null to omit the type attribute.
 */
function getVideoMimeType(mimeType: string | null | undefined): string | null {
  if (!mimeType) return null
  if (mimeType.startsWith('video/')) return mimeType
  // Non-specific or unknown mimeTypes should not prevent rendering
  // Return null to omit the type attribute
  return null
}

/**
 * Shared video player component for rendering video blocks in exercises and lesson introductions.
 * Handles:
 * - Absolute URL resolution (relative URLs are made absolute)
 * - MIME type handling (per FR-005)
 * - Fallback message when src is missing/unresolvable
 * - Runtime error handling with user-visible fallback
 */
export function VideoPlayer({ src, mimeType, className, media }: VideoPlayerProps) {
  const t = useTranslations('courses')
  const [hasError, setHasError] = useState(false)

  // Use src directly if provided, otherwise fall back to media.url
  const videoSrc = src ?? media?.url ?? null
  const resolvedMimeType = mimeType ?? media?.mimeType ?? null

  // If no source, render fallback message
  if (!videoSrc) {
    return (
      <div
        className={cn(
          'flex items-center justify-center p-4 text-muted-foreground text-sm',
          className,
        )}
      >
        <p>{t('videoUnavailable')}</p>
      </div>
    )
  }

  // Make URL absolute using getMediaUrl utility
  const absoluteSrc = getMediaUrl(videoSrc ?? undefined)

  // Determine the type attribute for the source element
  const typeAttribute = getVideoMimeType(resolvedMimeType)

  const handleError = () => {
    setHasError(true)
  }

  // If there was a runtime error loading the video, show fallback
  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center p-4 text-muted-foreground text-sm',
          className,
        )}
      >
        <p>{t('videoLoadError')}</p>
      </div>
    )
  }

  return (
    <video
      controls
      playsInline
      className={cn('w-full h-auto max-h-80', className)}
      onError={handleError}
    >
      <source src={absoluteSrc} type={typeAttribute ?? undefined} />
      {/* Fallback text for browsers that don't support video */}
      <p className="text-sm text-muted-foreground">{t('videoUnavailable')}</p>
    </video>
  )
}
