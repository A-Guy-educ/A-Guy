'use client'

import { cn } from '@/infra/utils/ui'
import React from 'react'

import type { Props as MediaProps } from '../types'

import { getMediaUrl } from '@/infra/utils/getMediaUrl'

export const DocumentMedia: React.FC<MediaProps> = (props) => {
  const { resource, className } = props

  if (resource && typeof resource === 'object') {
    const { filename, url, filesize } = resource

    const docUrl = url ? getMediaUrl(url) : filename ? getMediaUrl(`/media/${filename}`) : null

    if (!docUrl) {
      return null
    }

    return (
      <div className={cn('document-media', className)}>
        <a
          href={docUrl}
          download
          className="inline-flex items-center gap-content-gap-xs px-4 py-3 border border-border rounded-md text-inherit no-underline hover:bg-accent transition-colors"
        >
          <span>📄</span>
          <span>{filename || 'Document'}</span>
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
