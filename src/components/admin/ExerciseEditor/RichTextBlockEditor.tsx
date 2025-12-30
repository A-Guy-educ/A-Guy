'use client'

/**
 * Rich Text Block Editor - Math-aware Markdown
 */

import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import type { RichTextBlock } from '@/contracts'
import type { BlockEditorProps } from '../shared/types'
import { ErrorDisplay } from '../shared/ErrorDisplay'
import { PreviewErrorBoundary } from './previews/ErrorBoundary'

export function RichTextBlockEditor({ block, onChange, errors }: BlockEditorProps<RichTextBlock>) {
  const [value, setValue] = useState(block.value)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const debouncedOnChange = (newValue: string) => {
    setValue(newValue)
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    // Debounced onChange
    debounceTimerRef.current = setTimeout(() => {
      onChange({ ...block, value: newValue })
    }, 300)
  }

  return (
    <div>
      <ErrorDisplay errors={errors} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Editor */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            Editor
          </label>
          <textarea
            value={value}
            onChange={(e) => debouncedOnChange(e.target.value)}
            style={{
              width: '100%',
              height: '16rem',
              padding: '0.75rem',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
            }}
            placeholder="Type markdown here. Use $ for inline math: $x^2$ or $$ for block math:&#10;$$&#10;\\frac{1}{2}&#10;$$"
            spellCheck={false}
          />
          <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', opacity: 0.7 }}>
            Use <code>$...$</code> for inline math and <code>$$...$$</code> for block math
          </p>
        </div>

        {/* Preview */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            Preview
          </label>
          <PreviewErrorBoundary fallbackTitle="Markdown Preview Error">
            <div
              style={{
                height: '16rem',
                padding: '0.75rem',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: '4px',
                overflow: 'auto',
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {value || '*Empty*'}
              </ReactMarkdown>
            </div>
          </PreviewErrorBoundary>
        </div>
      </div>
    </div>
  )
}
