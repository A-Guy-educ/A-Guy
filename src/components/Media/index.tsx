import React, { Fragment } from 'react'

import type { Props } from './types'

import { ImageMedia } from './ImageMedia'
import { VideoMedia } from './VideoMedia'
import { AudioMedia } from './AudioMedia'
import { PDFMedia } from './PDFMedia'
import { SVGMedia } from './SVGMedia'
import { DocumentMedia } from './DocumentMedia'
import { ExternalMedia } from './ExternalMedia'
import { OtherMedia } from './OtherMedia'
import { MediaType } from '@/lib/media/types'
import { inferMediaType } from '@/lib/media/inferMediaType'
import type { Media } from '@/payload-types'

interface MediaWithType extends Media {
  type?: MediaType
}

export const Media: React.FC<Props> = (props) => {
  const { className, htmlElement = 'div', resource } = props

  const Tag = htmlElement || Fragment

  // Determine media type
  let mediaType: MediaType = MediaType.Other

  if (typeof resource === 'object' && resource) {
    // Prefer explicit type field
    mediaType = (resource as MediaWithType).type

    // Fallback to mimeType inference (for legacy data without type field)
    if (!mediaType && resource.mimeType) {
      mediaType = inferMediaType(resource.mimeType, resource.filename)
    }
  }

  return (
    <Tag
      {...(htmlElement !== null
        ? {
            className,
          }
        : {})}
    >
      {mediaType === MediaType.Image && <ImageMedia {...props} />}
      {mediaType === MediaType.Video && <VideoMedia {...props} />}
      {mediaType === MediaType.Audio && <AudioMedia {...props} />}
      {mediaType === MediaType.PDF && <PDFMedia {...props} />}
      {mediaType === MediaType.SVG && <SVGMedia {...props} />}
      {mediaType === MediaType.Document && <DocumentMedia {...props} />}
      {mediaType === MediaType.External && <ExternalMedia {...props} />}
      {(mediaType === MediaType.Other || !mediaType) && <OtherMedia {...props} />}
    </Tag>
  )
}
