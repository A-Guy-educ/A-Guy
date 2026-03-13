import React, { Fragment } from 'react'

import type { Props } from './types'

import { inferMediaType } from '@/infra/media/inferMediaType'
import { MediaType } from '@/infra/media/types'
import type { Media as PayloadMedia } from '@/payload-types'
import { AudioMedia } from './AudioMedia'
import { DocumentMedia } from './DocumentMedia'
import { ExternalMedia } from './ExternalMedia'
import { ImageMedia } from './ImageMedia'
import { LatexMedia } from './LatexMedia'
import { OtherMedia } from './OtherMedia'
import { PDFMedia } from './PDFMedia'
import { SVGMedia } from './SVGMedia'
import { VideoMedia } from './VideoMedia'

function isLatexFile(resource: unknown): boolean {
  if (typeof resource === 'object' && resource) {
    const filename = (resource as PayloadMedia).filename
    return !!filename && /\.tex$/i.test(filename)
  }
  return false
}

export const Media: React.FC<Props> = (props) => {
  const { className, htmlElement = 'div', resource } = props

  const Tag = htmlElement || Fragment

  // LaTeX files get their own renderer regardless of inferred type
  if (isLatexFile(resource)) {
    const inner = <LatexMedia {...props} />
    return Tag === Fragment ? inner : <Tag className={className}>{inner}</Tag>
  }

  // Determine media type
  let mediaType: MediaType = MediaType.Other

  if (typeof resource === 'object' && resource) {
    const mediaResource = resource as PayloadMedia
    if (mediaResource.type) {
      mediaType = mediaResource.type as MediaType
    } else if (mediaResource.mimeType) {
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
