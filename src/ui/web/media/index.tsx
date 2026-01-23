import React, { Fragment } from 'react'

import type { Props } from './types'

import { inferMediaType } from '@/infra/media/inferMediaType'
import { MediaType } from '@/infra/media/types'
import type { Media as PayloadMedia } from '@/payload-types'
import { AudioMedia } from './AudioMedia'
import { DocumentMedia } from './DocumentMedia'
import { ExternalMedia } from './ExternalMedia'
import { ImageMedia } from './ImageMedia'
import { OtherMedia } from './OtherMedia'
import { PDFMedia } from './PDFMedia'
import { SVGMedia } from './SVGMedia'
import { VideoMedia } from './VideoMedia'

export const Media: React.FC<Props> = (props) => {
  const { className, htmlElement = 'div', resource } = props

  const Tag = htmlElement || Fragment

  // Determine media type
  let mediaType: MediaType = MediaType.Other

  if (typeof resource === 'object' && resource) {
    const mediaResource = resource as PayloadMedia
    // Prefer explicit type field (Media type from payload-types has type as string literal)
    if (mediaResource.type) {
      // Map string literal to MediaType enum
      mediaType = mediaResource.type as MediaType
    } else if (mediaResource.mimeType) {
      // Fallback to mimeType inference (for legacy data without type field)
      mediaType = inferMediaType(mediaResource.mimeType, mediaResource.filename)
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
