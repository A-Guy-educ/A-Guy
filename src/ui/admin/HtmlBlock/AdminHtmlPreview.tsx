'use client'

import { sanitizeHtml } from '@/infra/utils/sanitize-html'

interface AdminHtmlPreviewProps {
  html: string
}

/**
 * Sanitized HTML preview for the Payload admin panel.
 * Uses only inline styles — no dependency on globals.css or .rich-text-content.
 */
export function AdminHtmlPreview({ html }: AdminHtmlPreviewProps) {
  const sanitized = sanitizeHtml(html)
  return (
    <div
      dangerouslySetInnerHTML={{ __html: sanitized }}
      style={{ fontSize: '0.875rem', lineHeight: '1.5', color: 'var(--theme-text)' }}
    />
  )
}
