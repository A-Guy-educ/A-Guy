'use client'

import DOMPurify from 'dompurify'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SAFE_HTML_PURIFY_CONFIG } from '@/ui/web/SafeHtml/sanitize-config'
import { handleSafeHtmlButtonClick } from '@/ui/web/SafeHtml/handleButtonAction'

interface HtmlBlockRendererProps {
  block: {
    type: 'html'
    html: string
  }
}

export function HtmlBlockRenderer({ block }: HtmlBlockRendererProps) {
  const [isMounted, setIsMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

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
    return DOMPurify.sanitize(block.html, SAFE_HTML_PURIFY_CONFIG)
  }, [isMounted, block.html])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !cleanHtml) return
    const onClick = (event: MouseEvent) => handleSafeHtmlButtonClick(event, container)
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [cleanHtml])

  if (!cleanHtml) return null

  return (
    <div
      ref={containerRef}
      className="html-block-content"
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  )
}
