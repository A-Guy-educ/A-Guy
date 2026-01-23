'use client'

import { cn } from '@/utilities/ui'
import React from 'react'

import type { Props as MediaProps } from '../types'
import type { Media } from '@/payload-types'

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

    // Simple iframe embed (could be enhanced to detect URL type)
    return (
      <div className={cn('external-media', className)}>
        <iframe
          src={externalUrl}
          className="w-full h-[400px] border border-border rounded"
          title="External content"
        />
      </div>
    )
  }

  return null
}
