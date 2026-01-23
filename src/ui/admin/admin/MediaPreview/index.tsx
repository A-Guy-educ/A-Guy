'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'

import { ImagePreview } from './ImagePreview'
import { VideoPreview } from './VideoPreview'
import { AudioPreview } from './AudioPreview'
import { PDFPreview } from './PDFPreview'
import { SVGPreview } from './SVGPreview'
import { DocumentPreview } from './DocumentPreview'
import { ExternalPreview } from './ExternalPreview'
import { OtherPreview } from './OtherPreview'
import { MediaType } from '@/server/media/types'

export const MediaPreview: UIFieldClientComponent = () => {
  const typeField = useFormFields(([fields]) => fields.type)

  const type = typeField?.value as MediaType | undefined

  if (!type) {
    return <div className="p-4">No media type selected</div>
  }

  switch (type) {
    case MediaType.Image:
      return <ImagePreview />
    case MediaType.Video:
      return <VideoPreview />
    case MediaType.Audio:
      return <AudioPreview />
    case MediaType.PDF:
      return <PDFPreview />
    case MediaType.SVG:
      return <SVGPreview />
    case MediaType.Document:
      return <DocumentPreview />
    case MediaType.External:
      return <ExternalPreview />
    case MediaType.Other:
      return <OtherPreview />
    default:
      return <OtherPreview />
  }
}
