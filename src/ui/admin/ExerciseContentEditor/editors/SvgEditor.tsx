'use client'

import React, { useMemo, useRef } from 'react'
import type { SvgBlock } from '@/server/payload/collections/Exercises/types'
import { sanitizeSvg } from '@/ui/admin/shared/utils'

interface SvgEditorProps {
  block: SvgBlock
  onChange: (block: SvgBlock) => void
}

function validateSvg(value: string): { valid: boolean; error?: string } {
  if (!value.trim()) return { valid: false, error: 'SVG content is empty' }
  if (!value.includes('<svg')) return { valid: false, error: 'Missing <svg> element' }
  if (!value.includes('</svg>') && !value.includes('/>')) {
    return { valid: false, error: 'SVG element is not closed' }
  }
  if (typeof DOMParser === 'undefined') return { valid: true }
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(value, 'image/svg+xml')
    const errorNode = doc.querySelector('parsererror')
    if (errorNode) {
      return {
        valid: false,
        error: 'Malformed XML: ' + (errorNode.textContent?.slice(0, 80) ?? ''),
      }
    }
    if (!doc.querySelector('svg')) return { valid: false, error: 'No root <svg> element found' }
    return { valid: true }
  } catch {
    return { valid: false, error: 'Failed to parse SVG' }
  }
}

export const SvgEditor: React.FC<SvgEditorProps> = ({ block, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validation = useMemo(() => validateSvg(block.value), [block.value])
  const sanitized = useMemo(() => {
    if (!validation.valid) return null
    return sanitizeSvg(block.value)
  }, [block.value, validation.valid])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.name.endsWith('.svg')) return
    const reader = new FileReader()
    reader.onload = () => {
      const content = reader.result as string
      const { sanitized: cleaned } = sanitizeSvg(content)
      onChange({ ...block, value: cleaned || content })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="svg-editor">
      <div className="question-editor-section">
        <label className="question-editor-label">SVG Code</label>
        <div className="svg-editor-toolbar">
          <button
            type="button"
            className="svg-editor-upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload .svg
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <span
            className={`svg-editor-status ${validation.valid ? 'svg-editor-status--valid' : 'svg-editor-status--invalid'}`}
          >
            {validation.valid ? 'Valid' : validation.error}
          </span>
        </div>
        <textarea
          className="svg-editor-textarea"
          value={block.value}
          onChange={(e) => onChange({ ...block, value: e.target.value })}
          spellCheck={false}
        />
      </div>

      <div className="question-editor-section">
        <label className="question-editor-label">Preview</label>
        <div className="svg-editor-preview">
          {validation.valid && sanitized ? (
            <div dangerouslySetInnerHTML={{ __html: sanitized.sanitized }} />
          ) : (
            <div className="svg-editor-preview-error">
              {validation.error || 'No valid SVG to preview'}
            </div>
          )}
        </div>
      </div>

      <div className="question-editor-section">
        <label className="question-editor-label">Alt Text</label>
        <input
          type="text"
          className="svg-editor-alt-input"
          value={block.altText || ''}
          onChange={(e) => onChange({ ...block, altText: e.target.value })}
          placeholder="Describe this image for accessibility..."
        />
      </div>
    </div>
  )
}
