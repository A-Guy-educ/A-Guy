'use client'

import { cn } from '@/utilities/ui'
import React from 'react'

import type { Props as MediaProps } from '../types'

import { getMediaUrl } from '@/utilities/getMediaUrl'

export const AudioMedia: React.FC<MediaProps> = (props) => {
  const { resource, className } = props

  if (resource && typeof resource === 'object') {
    const { filename, url } = resource

    const audioUrl = url ? getMediaUrl(url) : filename ? getMediaUrl(`/media/${filename}`) : null

    if (!audioUrl) {
      return null
    }

    return (
      <div className={cn('audio-media', className)}>
        <audio controls className="w-full">
          <source src={audioUrl} />
          Your browser does not support the audio tag.
        </audio>
      </div>
    )
  }

  return null
}
