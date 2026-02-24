'use client'

import DOMPurify from 'dompurify'
import { useEffect, useMemo, useState } from 'react'

interface HtmlBlockRendererProps {
  block: {
    type: 'html'
    html: string
  }
}

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'hr',
    'span',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'del',
    'ins',
    'mark',
    'sub',
    'sup',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'code',
    'a',
    'img',
    'div',
    'section',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  ALLOWED_ATTR: [
    'href',
    'src',
    'alt',
    'title',
    'class',
    'target',
    'rel',
    'width',
    'height',
    'colspan',
    'rowspan',
    'dir',
  ],
}

export function HtmlBlockRenderer({ block }: HtmlBlockRendererProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    // Force rel="noopener noreferrer" on links with target attribute to prevent tabnapping
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && node.getAttribute('target')) {
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
    setIsMounted(true)
    return () => {
      DOMPurify.removeAllHooks()
    }
  }, [])

  const cleanHtml = useMemo(() => {
    if (!isMounted || !block.html?.trim()) return ''
    return DOMPurify.sanitize(block.html, PURIFY_CONFIG)
  }, [isMounted, block.html])

  if (!cleanHtml) return null

  return <div className="html-block-content" dangerouslySetInnerHTML={{ __html: cleanHtml }} />
}
