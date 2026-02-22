import { useMemo } from 'react'
import { sanitizeHtml } from '@/infra/utils/sanitize-html'
import { cn } from '@/infra/utils/ui'

interface HtmlRendererProps {
  html: string
  /** Extra classes merged onto the wrapper div. */
  className?: string
  /**
   * Text direction. Defaults to "auto" (browser detects per-paragraph).
   * Pass "rtl" or "ltr" when the page locale is known.
   */
  dir?: 'auto' | 'rtl' | 'ltr'
}

/**
 * Canonical renderer for user/content HTML on the frontend.
 * - Sanitizes via the shared `sanitizeHtml` utility on every render
 * - Applies site typography via .rich-text-content (globals.css)
 * - Supports RTL/LTR via dir prop (default: "auto")
 * - Layout safety (images, tables, long words) handled by .rich-text-content CSS
 *
 * No 'use client' required — `sanitizeHtml` is safe for both SSR and browser usage.
 * Never use dangerouslySetInnerHTML for content fields outside this component.
 */
export function HtmlRenderer({ html, className, dir = 'auto' }: HtmlRendererProps) {
  const sanitized = useMemo(() => sanitizeHtml(html), [html])
  return (
    <div
      dir={dir}
      className={cn('rich-text-content', className)}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
