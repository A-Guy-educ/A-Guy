'use client'

import { cn } from '@/utilities/ui'
import React from 'react'
import Image from 'next/image'

import type { Props as MediaProps } from '../types'

import { getMediaUrl } from '@/utilities/getMediaUrl'

export const SVGMedia: React.FC<MediaProps> = (props) => {
  const { resource, className, imgClassName, alt } = props

  if (resource && typeof resource === 'object') {
    const { filename, url, alt: altFromResource, width, height } = resource

    const svgUrl = url ? getMediaUrl(url) : filename ? getMediaUrl(`/media/${filename}`) : null

    if (!svgUrl) {
      return null
    }

    const altText = alt || altFromResource || 'SVG image'

    return (
      <div className={cn('svg-media', className)}>
        <Image
          src={svgUrl}
          alt={altText}
          width={width || 800}
          height={height || 600}
          className={cn('max-w-full h-auto', imgClassName)}
          unoptimized
        />
      </div>
    )
  }

  return null
}
