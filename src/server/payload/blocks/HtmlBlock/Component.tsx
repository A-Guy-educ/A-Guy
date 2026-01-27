import React from 'react'

import type { HtmlBlock as HtmlBlockProps } from '@/payload-types'

export const HtmlBlock: React.FC<HtmlBlockProps> = ({ html }) => {
  // HTML is strictly validated server-side
  // Safe to render directly

  return <div className="container my-16 html-block" dangerouslySetInnerHTML={{ __html: html }} />
}
