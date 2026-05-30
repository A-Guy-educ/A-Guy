'use client'

/**
 * @fileType component
 * @ai-summary Raw HTML editor for the exercise HtmlBlock — admin-only.
 *
 * SECURITY NOTE: Admin-only. HTML is stored verbatim (no sanitization) so admins
 * can author any tags/attributes/inline styles. Student-facing rendering is
 * sanitized separately.
 */

import type { HtmlBlock } from '@/server/payload/collections/Exercises/types'
import { parseHtmlToGuidedExplanation } from '@/infra/contracts/guided-explanation/parseHtmlToGuidedExplanation'
import React, { useRef, useState } from 'react'

type Mode = 'edit' | 'preview'

interface HtmlBlockEditorProps {
  block: HtmlBlock
  onChange: (block: HtmlBlock) => void
}

export const HtmlBlockEditor: React.FC<HtmlBlockEditorProps> = ({ block, onChange }) => {
  const [mode, setMode] = useState<Mode>('edit')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasGuidedExplanation = !!block.guidedExplanation

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...block, html: e.target.value })
  }

  const handleImportHtml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const html = reader.result as string
      const payload = parseHtmlToGuidedExplanation(html)
      if (payload) {
        onChange({ ...block, guidedExplanation: payload })
      } else {
        // Admin-only: keep imported HTML verbatim.
        onChange({ ...block, html, guidedExplanation: undefined })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleClearGuided = () => {
    onChange({ ...block, guidedExplanation: undefined })
  }

  return (
    <div className="html-block-editor">
      <div className="html-block-editor-header">
        <span className="html-block-editor-label">
          {hasGuidedExplanation ? 'Guided Explanation' : 'HTML Block'}
        </span>
        <div className="html-block-editor-actions">
          {!hasGuidedExplanation && (
            <>
              <button
                type="button"
                className={`html-editor-source-toggle ${mode === 'edit' ? 'html-editor-source-toggle--active' : ''}`}
                onClick={() => setMode('edit')}
              >
                Edit
              </button>
              <button
                type="button"
                className={`html-editor-source-toggle ${mode === 'preview' ? 'html-editor-source-toggle--active' : ''}`}
                onClick={() => setMode('preview')}
              >
                Preview
              </button>
            </>
          )}
          <button
            type="button"
            className="html-editor-source-toggle"
            onClick={() => fileInputRef.current?.click()}
          >
            Import HTML
          </button>
          {hasGuidedExplanation && (
            <button type="button" className="html-editor-source-toggle" onClick={handleClearGuided}>
              Clear Guided
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            onChange={handleImportHtml}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {hasGuidedExplanation ? (
        <div className="html-block-guided-info">
          <p className="html-block-guided-title">{block.guidedExplanation?.title}</p>
          <p className="html-block-guided-meta">
            {block.guidedExplanation?.steps.length} steps
            {block.guidedExplanation?.proofTable
              ? ` · ${block.guidedExplanation.proofTable.rows.length} proof rows`
              : ''}
            {' · '}
            {block.guidedExplanation?.direction.toUpperCase()}
          </p>
        </div>
      ) : mode === 'edit' ? (
        <textarea
          className="html-block-source-textarea"
          value={block.html}
          onChange={handleSourceChange}
          placeholder="Enter raw HTML here..."
          rows={12}
        />
      ) : (
        <div
          className="html-block-preview-pane"
          // Admin-only preview: render exactly what was authored.
          dangerouslySetInnerHTML={{ __html: block.html || '' }}
        />
      )}
    </div>
  )
}
