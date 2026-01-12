'use client'

import React from 'react'
import dynamic from 'next/dynamic'

import type { Props as MediaProps } from '../types'

// Import with ssr: false to prevent server-side rendering
const PDFViewerFull = dynamic(
  () => import('./PDFViewerFull').then((mod) => mod.PDFViewerFull),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[841px] border rounded-lg bg-muted/30">
        <div className="text-muted-foreground">Loading PDF viewer...</div>
      </div>
    ),
  },
)

export const PDFMedia: React.FC<MediaProps> = (props) => {
  return <PDFViewerFull {...props} />
}
