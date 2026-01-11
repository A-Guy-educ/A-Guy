'use client'

import { cn } from '@/utilities/ui'
import React from 'react'

import type { Props as MediaProps } from '../types'

import { getMediaUrl } from '@/utilities/getMediaUrl'

export const SVGMedia: React.FC<MediaProps> = (props) => {
  const { resource, className, imgClassName, alt } = props

  if (resource && typeof resource === 'object') {
    const { filename, url, alt: altFromResource } = resource

    const svgUrl = url ? getMediaUrl(url) : filename ? getMediaUrl(`/media/${filename}`) : null

    if (!svgUrl) {
      return null
    }

    const altText = alt || altFromResource || 'SVG image'

    return (
      <div className={cn('svg-media', className)}>
        <img src={svgUrl} alt={altText} className={cn('max-w-full h-auto', imgClassName)} />
      </div>
    )
  }

  return null
}
