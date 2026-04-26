'use client'

import DOMPurify from 'dompurify'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/infra/utils/ui'
import { registerPurifyHook, unregisterPurifyHook } from '@/ui/web/shared/DOMPurifyHooks'

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

  useEffect(() => {
    registerPurifyHook()
    setIsMounted(true)
    return () => {
      unregisterPurifyHook()
    }
  }, [])

  const cleanHtml = useMemo(() => {
    if (!isMounted || !html?.trim()) return ''
    return DOMPurify.sanitize(html, PURIFY_CONFIG)
  }, [isMounted, html])

  if (!cleanHtml) return null

  const mergedClassName = cn(enableProse && PROSE_CLASSES, className)

  return (
    <div
      className={mergedClassName || undefined}
      style={style}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  )
}
