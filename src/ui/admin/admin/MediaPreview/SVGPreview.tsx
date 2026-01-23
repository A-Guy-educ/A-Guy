'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'
import Image from 'next/image'

export const SVGPreview: React.FC = () => {
  const urlField = useFormFields(([fields]) => fields.url)
  const altField = useFormFields(([fields]) => fields.alt)

  const url = urlField?.value as string | undefined
  const alt = altField?.value as string | undefined

  if (!url) {
    return (
      <div className="p-4">
        <p>No SVG uploaded yet</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <Image
        src={url}
        alt={alt || 'SVG Preview'}
        width={800}
        height={600}
        className="max-w-full h-auto rounded"
        style={{ objectFit: 'contain' }}
        unoptimized
      />
    </div>
  )
}
