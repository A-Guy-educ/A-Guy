'use client'

import { HTML_BLOCK_PURIFY_CONFIG, initDOMPurifySafeLinks } from '@/lib/sanitize/config'
import DOMPurify from 'dompurify'
import { useEffect, useMemo, useState } from 'react'

interface HtmlBlockRendererProps {
  block: {
    type: 'html'
    html: string
  }
}

export function HtmlBlockRenderer({ block }: HtmlBlockRendererProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    // Initialize safe link handling hook (idempotent - safe to call multiple times)
    initDOMPurifySafeLinks()
    setIsMounted(true)
  }, [])

  const cleanHtml = useMemo(() => {
    if (!isMounted || !block.html?.trim()) return ''
    return DOMPurify.sanitize(block.html, HTML_BLOCK_PURIFY_CONFIG)
  }, [isMounted, block.html])

  if (!cleanHtml) return null

  return <div className="html-block-content" dangerouslySetInnerHTML={{ __html: cleanHtml }} />
}
