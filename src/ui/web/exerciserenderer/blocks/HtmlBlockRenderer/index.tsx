'use client'

import DOMPurify from 'dompurify'
import { useEffect, useMemo, useState } from 'react'
import { GuidedExplanationV1Schema } from '@/infra/contracts/guided-explanation/v1'
import type { HtmlBlock } from '@/server/payload/collections/Exercises/types'
import { GuidedExplanationRunner } from '@/ui/web/GuidedExplanationRunner'

interface HtmlBlockRendererProps {
  block: HtmlBlock
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
  // When a guided explanation payload is present and valid, render the
  // trusted runner. safeParse guards against malformed data from DB
  // migrations or API bugs — falls back to static HTML on failure.
  if (block.guidedExplanation) {
    const parsed = GuidedExplanationV1Schema.safeParse(block.guidedExplanation)
    if (parsed.success) {
      return <GuidedExplanationRunner payload={parsed.data} />
    }
  }

  return <StaticHtmlRenderer html={block.html} />
}

function StaticHtmlRenderer({ html }: { html: string }) {
  const [isMounted, setIsMounted] = useState(false)

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
    return DOMPurify.sanitize(html, PURIFY_CONFIG)
  }, [isMounted, html])

  if (!cleanHtml) return null

  return <div className="html-block-content" dangerouslySetInnerHTML={{ __html: cleanHtml }} />
}
