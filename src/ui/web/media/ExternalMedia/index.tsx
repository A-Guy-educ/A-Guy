'use client'

import { cn } from '@/infra/utils/ui'
import React from 'react'

import type { Media } from '@/payload-types'
import type { Props as MediaProps } from '../types'

/**
 * Extended Media type with embed fields.
 * These fields are populated by the resolveEmbed hook when type === 'external'.
 */
interface ExternalMediaResource extends Media {
  externalUrl?: string | null
  embedProvider?: 'youtube' | 'generic' | null
  embedVideoId?: string | null
  embedUrl?: string | null
  embedTitle?: string | null
  embedThumbnailUrl?: string | null
}

/**
 * Renders a YouTube embed with proper 16:9 aspect ratio.
 *
 * Key attributes:
 * - youtube-nocookie.com: Privacy-enhanced mode (no tracking cookies)
 * - loading="lazy": Don't load the iframe until it's near the viewport
 * - allowFullScreen: Users can go fullscreen
 * - allow="...": Permissions for the iframe (autoplay, clipboard, etc.)
 */
function YouTubeEmbed({
  videoId,
  embedUrl,
  title,
  className,
}: {
  videoId: string
  embedUrl: string
  title: string | null | undefined
  className?: string
}) {
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-lg', className)}
      style={{ aspectRatio: '16 / 9' }}
    >
      <iframe
        src={embedUrl}
        title={title || `YouTube video ${videoId}`}
        className="absolute inset-0 h-full w-full"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}

/**
 * Generic iframe embed for non-YouTube URLs.
 * Falls back to the original behavior: a plain iframe with the URL.
 */
function GenericEmbed({
  url,
  title,
  className,
}: {
  url: string
  title: string | null | undefined
  className?: string
}) {
  return (
    <div className={cn('external-media', className)}>
      <iframe
        src={url}
        title={title || 'External content'}
        className="w-full h-[400px] border border-border rounded"
        loading="lazy"
      />
    </div>
  )
}

/**
 * Main ExternalMedia component.
 *
 * Routes to the correct renderer based on embedProvider:
 * - 'youtube' -> YouTubeEmbed (proper 16:9 responsive player)
 * - 'generic' or missing -> GenericEmbed (plain iframe, like before)
 *
 * This component is used by the main <Media> component (src/ui/web/media/index.tsx)
 * when the media document has type === 'external'. It receives the full media
 * document as props.resource, which includes the embed fields set by the hook.
 */
export const ExternalMedia: React.FC<MediaProps> = (props) => {
  const { resource, className } = props

  if (!resource || typeof resource !== 'object') {
    return null
  }

  const media = resource as ExternalMediaResource

  // If we have an embed URL from the hook, use the provider-specific renderer
  if (media.embedProvider === 'youtube' && media.embedVideoId && media.embedUrl) {
    return (
      <YouTubeEmbed
        videoId={media.embedVideoId}
        embedUrl={media.embedUrl}
        title={media.embedTitle}
        className={className}
      />
    )
  }

  // If we have an embedUrl but not YouTube, use generic embed with the resolved URL
  if (media.embedUrl) {
    return <GenericEmbed url={media.embedUrl} title={media.embedTitle} className={className} />
  }

  // Fallback: use the raw externalUrl (for legacy data without embed fields)
  if (media.externalUrl) {
    return <GenericEmbed url={media.externalUrl} title={null} className={className} />
  }

  return <p className={cn('text-muted-foreground', className)}>No external URL provided</p>
}
