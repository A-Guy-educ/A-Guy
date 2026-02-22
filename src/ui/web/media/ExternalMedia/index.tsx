'use client'

import { cn } from '@/infra/utils/ui'
import React from 'react'

import { getYouTubeEmbedUrl } from '@/infra/media/youtube'
import type { Media } from '@/payload-types'
import type { Props as MediaProps } from '../types'

interface ExternalMediaResource extends Media {
  externalUrl?: string
}

export const ExternalMedia: React.FC<MediaProps> = (props) => {
  const { resource, className } = props

  if (resource && typeof resource === 'object') {
    const externalUrl = (resource as ExternalMediaResource).externalUrl

    if (!externalUrl) {
      return <p className={cn('external-media-error', className)}>No external URL provided</p>
    }

    const youTubeEmbedUrl = getYouTubeEmbedUrl(externalUrl)

    if (youTubeEmbedUrl) {
      return (
        <div className={cn('external-media', className)}>
          <div className="relative w-full overflow-hidden rounded" style={{ paddingTop: '56.25%' }}>
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
        </div>
      )
    }

    return (
      <div className={cn('external-media', className)}>
        <iframe
          src={externalUrl}
          className="h-[400px] w-full rounded border border-border"
          title="External content"
        />
      </div>
    )
  }

  return null
}
