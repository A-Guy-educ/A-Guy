'use client'

import DOMPurify from 'dompurify'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/infra/utils/ui'
import { SAFE_HTML_PURIFY_CONFIG } from './sanitize-config'
import { handleSafeHtmlButtonClick } from './handleButtonAction'

/** Default prose classes applied when enableProse is true */
const PROSE_CLASSES = 'prose prose-slate dark:prose-invert max-w-none'

interface SafeHtmlProps {
  html: string
  className?: string
  style?: React.CSSProperties
  /**
   * When true, wraps the content with Tailwind Typography `prose` classes
   * so semantic HTML (headings, lists, tables, blockquotes) is styled
   * responsively without needing Tailwind classes in the DB content.
   *
   * @default false
   */
  enableProse?: boolean
}

export function SafeHtml({ html, className, style, enableProse = false }: SafeHtmlProps) {
  const [isMounted, setIsMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
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
    if (!isMounted || !html?.trim()) return ''
    return DOMPurify.sanitize(html, SAFE_HTML_PURIFY_CONFIG)
  }, [isMounted, html])

  // Event delegation for author-wired <button data-action="..."> elements.
  useEffect(() => {
    const container = containerRef.current
    if (!container || !cleanHtml) return
    const onClick = (event: MouseEvent) => handleSafeHtmlButtonClick(event, container)
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [cleanHtml])

  if (!cleanHtml) return null

  const mergedClassName = cn(enableProse && PROSE_CLASSES, className)

  return (
    <div
      ref={containerRef}
      className={mergedClassName || undefined}
      style={style}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  )
}
