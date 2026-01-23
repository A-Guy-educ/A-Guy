/**
 * Shared utilities for Exercise admin editors
 */

import { ZodError } from 'zod'
import type { EditorError } from './types'

/**
 * Convert Zod validation errors to editor error format
 */
export function zodErrorsToEditorErrors(error: ZodError, prefix = ''): EditorError[] {
  return error.issues.map((issue) => ({
    path: prefix ? `${prefix}.${issue.path.join('.')}` : issue.path.join('.'),
    message: issue.message,
  }))
}

/**
 * Get errors for a specific path
 */
export function getErrorsForPath(errors: EditorError[] | undefined, path: string): EditorError[] {
  if (!errors) return []
  return errors.filter((err) => err.path === path || err.path.startsWith(`${path}.`))
}

/**
 * Generate a unique block ID
 */
export function generateBlockId(): string {
  return `b${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Sanitize SVG content to prevent XSS attacks
 * Removes dangerous elements and attributes
 */
export function sanitizeSvg(svg: string): { safe: boolean; sanitized: string } {
  const trimmed = svg.trim()

  // Check if it's SVG
  if (!trimmed.toLowerCase().includes('<svg')) {
    return { safe: false, sanitized: '' }
  }

  // Remove script tags
  let sanitized = trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove event handlers (on* attributes)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '')

  // Remove foreignObject (can execute JavaScript)
  sanitized = sanitized.replace(
    /<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi,
    '',
  )

  // Remove external references in href/xlink:href that aren't data URIs
  sanitized = sanitized.replace(/\b(?:href|xlink:href)\s*=\s*["'](?!data:)(?!#)[^"']*["']/gi, '')

  // Check if sanitization removed content
  const wasDangerous = sanitized !== trimmed

  return {
    safe: !wasDangerous,
    sanitized,
  }
}
