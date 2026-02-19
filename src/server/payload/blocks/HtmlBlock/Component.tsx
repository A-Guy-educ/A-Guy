import React from 'react'

import type { HtmlBlock as HtmlBlockProps } from '@/payload-types'
import { HtmlRenderer } from '@/ui/web/shared/HtmlRenderer'

export const HtmlBlock: React.FC<HtmlBlockProps> = ({ html }) => {
  // HTML content is validated server-side before storage
  // Validation includes: blocked tags, event handlers, dangerous URLs, href restrictions, attribute allowlist

  return <HtmlRenderer html={html} className="container my-16 html-block" />
}
