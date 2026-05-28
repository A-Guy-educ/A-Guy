'use client'

/**
 * @fileType component
 * @ai-summary Raw HTML editor for HtmlBlock — admin-only content creation.
 *
 * SECURITY NOTE: This component is admin-only — only authorized content creators
 * (teachers) have access to it. The HTML is stored verbatim so admins can use any
 * tags/attributes/inline styles. Content shown to students goes through separate
 * rendering logic with proper sanitization.
 */

import { useField } from '@payloadcms/ui'
import React, { useState } from 'react'

type Mode = 'edit' | 'preview'

export const QuillField: React.FC<{ path: string }> = ({ path }) => {
  const { value, setValue } = useField<string>({ path })
  const [mode, setMode] = useState<Mode>('edit')

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
  }

  return (
    <div className="html-block-editor">
      <div className="html-block-editor-header">
        <span className="html-block-editor-label">HTML Block</span>
        <div className="html-block-editor-actions">
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
        </div>
      </div>

      {mode === 'edit' ? (
        <textarea
          className="html-block-source-textarea"
          value={value || ''}
          onChange={handleSourceChange}
          placeholder="Enter raw HTML here..."
          rows={12}
        />
      ) : (
        <div
          className="html-block-preview-pane"
          // Admin-only preview: render exactly what was authored.
          dangerouslySetInnerHTML={{ __html: value || '' }}
        />
      )}
    </div>
  )
}
