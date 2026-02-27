'use client'

import { HTML_BLOCK_PURIFY_CONFIG, initDOMPurifySafeLinks } from '@/lib/sanitize/config'
import DOMPurify from 'dompurify'
import { useEffect, useMemo, useState } from 'react'

interface SafeHtmlProps {
  html: string
  className?: string
  style?: React.CSSProperties
}

export function SafeHtml({ html, className, style }: SafeHtmlProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    // Initialize safe link handling hook (idempotent - safe to call multiple times)
    initDOMPurifySafeLinks()
    setIsMounted(true)
  }, [])

  const cleanHtml = useMemo(() => {
    if (!isMounted || !html?.trim()) return ''
    return DOMPurify.sanitize(html, HTML_BLOCK_PURIFY_CONFIG)
  }, [isMounted, html])

  if (!cleanHtml) return null

  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: cleanHtml }} />
}
