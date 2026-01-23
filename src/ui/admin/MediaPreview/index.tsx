'use client'

import { useFormFields } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'

import { MediaType } from '@/infra/media/types'
import { AudioPreview } from './AudioPreview'
import { DocumentPreview } from './DocumentPreview'
import { ExternalPreview } from './ExternalPreview'
import { ImagePreview } from './ImagePreview'
import { OtherPreview } from './OtherPreview'
import { PDFPreview } from './PDFPreview'
import { SVGPreview } from './SVGPreview'
import { VideoPreview } from './VideoPreview'

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
