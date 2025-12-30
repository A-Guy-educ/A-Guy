'use client'

/**
 * SVG Block Editor
 */

import React, { useState, useRef, useEffect, useMemo } from 'react'
import type { SvgBlock } from '@/contracts'
import type { BlockEditorProps } from '../shared/types'
import { ErrorDisplay } from '../shared/ErrorDisplay'
import { sanitizeSvg } from '../shared/utils'
import { PreviewErrorBoundary } from './previews/ErrorBoundary'

export function SvgBlockEditor({
  block,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  errors,
}: BlockEditorProps<SvgBlock>) {
  const [svg, setSvg] = useState(block.svg)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const debouncedOnChange = (newSvg: string) => {
    setSvg(newSvg)
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    // Debounced onChange
    debounceTimerRef.current = setTimeout(() => {
      onChange({ ...block, svg: newSvg })
    }, 300)
  }

  // Sanitize SVG for preview
  const sanitizedResult = useMemo(() => sanitizeSvg(svg), [svg])
  const { safe: isSvgSafe, sanitized: sanitizedSvg } = sanitizedResult
  const isSvgValid = svg.trim().toLowerCase().includes('<svg')

  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '1rem',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: '4px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <h4>SVG</h4>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="btn btn--style-secondary btn--size-small"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="btn btn--style-secondary btn--size-small"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="btn btn--style-secondary btn--size-small"
          >
            Delete
          </button>
        </div>
      </div>

      <ErrorDisplay errors={errors} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Editor */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            SVG Code
          </label>
          <textarea
            value={svg}
            onChange={(e) => debouncedOnChange(e.target.value)}
            style={{
              width: '100%',
              height: '16rem',
              padding: '0.75rem',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
            }}
            placeholder="Paste SVG code here..."
            spellCheck={false}
          />
          <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', opacity: 0.7 }}>
            Paste your SVG code (must start with &lt;svg&gt;)
          </p>
        </div>

        {/* Preview */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            Preview
          </label>
          <PreviewErrorBoundary fallbackTitle="SVG Preview Error">
            <div
              style={{
                height: '16rem',
                padding: '0.75rem',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: '4px',
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!isSvgValid ? (
                <p style={{ fontSize: '0.875rem', opacity: 0.7, fontStyle: 'italic' }}>
                  {svg ? 'Invalid SVG (must start with <svg>)' : 'No SVG code'}
                </p>
              ) : !isSvgSafe ? (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--theme-error-500)',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                    }}
                  >
                    SVG preview disabled (unsafe)
                  </p>
                  <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                    Contains script, event handlers, or external references
                  </p>
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />
              )}
            </div>
          </PreviewErrorBoundary>
          {isSvgValid && !isSvgSafe && (
            <p
              style={{
                marginTop: '0.25rem',
                fontSize: '0.75rem',
                color: 'var(--theme-error-500)',
              }}
            >
              ⚠️ Warning: Dangerous content removed from preview
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
