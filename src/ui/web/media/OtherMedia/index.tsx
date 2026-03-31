'use client'

import { cn } from '@/infra/utils/ui'
import React from 'react'

import type { Props as MediaProps } from '../types'

import { getMediaUrl } from '@/infra/utils/getMediaUrl'

export const OtherMedia: React.FC<MediaProps> = (props) => {
  const { resource, className } = props

  if (resource && typeof resource === 'object') {
    const { url, filename, filesize } = resource

    const fileUrl = url ? getMediaUrl(url) : filename ? getMediaUrl(`/media/${filename}`) : null

    if (!fileUrl) {
      return null
    }

    return (
      <div className={cn('other-media', className)}>
        <a
          href={fileUrl}
          download
          className="inline-flex items-center gap-content-gap-xs px-4 py-3 border border-border rounded-md text-inherit no-underline hover:bg-accent transition-colors"
        >
          <span>📄</span>
          <span>{filename || 'File'}</span>
          {filesize && (
            <span className="text-body-sm text-muted-foreground">
              ({Math.round(filesize / 1024)} KB)
            </span>
          )}
        </a>
      </div>
    )
  }

  return null
}
