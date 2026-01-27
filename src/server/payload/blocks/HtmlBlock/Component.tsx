import React from 'react'

import type { HtmlBlock as HtmlBlockProps } from '@/payload-types'

export const HtmlBlock: React.FC<HtmlBlockProps> = ({ html }) => {
  // HTML content is validated server-side before storage
  // Validation includes: blocked tags, event handlers, dangerous URLs, href restrictions, attribute allowlist

  return <div className="container my-16 html-block" dangerouslySetInnerHTML={{ __html: html }} />
}
