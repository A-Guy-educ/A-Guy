'use client'

import type { HtmlBlock } from '@/server/payload/collections/Exercises/types'
import DOMPurify from 'dompurify'
import dynamic from 'next/dynamic'
import React, { useMemo, useState } from 'react'
import 'react-quill-new/dist/quill.snow.css'
import { SAFE_HTML_PURIFY_CONFIG } from '@/ui/web/SafeHtml/sanitize-config'
import { SafeHtml } from '@/ui/web/SafeHtml'

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    [{ direction: 'rtl' }],
    ['clean'],
  ],
}

const QUILL_FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',
  'bullet',
  'blockquote',
  'code-block',
  'link',
  'image',
  'direction',
]

type EditorMode = 'visual' | 'source' | 'preview'

interface HtmlBlockEditorProps {
  block: HtmlBlock
  onChange: (block: HtmlBlock) => void
}

export const HtmlBlockEditor: React.FC<HtmlBlockEditorProps> = ({ block, onChange }) => {
  const [mode, setMode] = useState<EditorMode>('visual')

  // Memoize to prevent Quill re-initialization on re-render
  const modules = useMemo(() => QUILL_MODULES, [])

  const handleChange = (html: string) => {
    const normalized = html === '<p><br></p>' ? '' : html
    onChange({ ...block, html: normalized })
  }

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...block, html: e.target.value })
  }

  const switchMode = (next: EditorMode) => {
    // When leaving source view, sanitize so any dangerous raw HTML pasted
    // by the author is stripped before it hits the database.
    if (mode === 'source' && next !== 'source' && block.html) {
      const sanitized = DOMPurify.sanitize(block.html, SAFE_HTML_PURIFY_CONFIG)
      if (sanitized !== block.html) {
        onChange({ ...block, html: sanitized })
      }
    }
    setMode(next)
  }

  return (
    <div className="html-block-editor">
      <div className="html-block-editor-header">
        <span className="html-block-editor-label">HTML Block</span>
        <div className="html-block-editor-mode-switch">
          <button
            type="button"
            className={`html-editor-source-toggle ${mode === 'visual' ? 'html-editor-source-toggle--active' : ''}`}
            onClick={() => switchMode('visual')}
          >
            Visual
          </button>
          <button
            type="button"
            className={`html-editor-source-toggle ${mode === 'source' ? 'html-editor-source-toggle--active' : ''}`}
            onClick={() => switchMode('source')}
          >
            HTML Source
          </button>
          <button
            type="button"
            className={`html-editor-source-toggle ${mode === 'preview' ? 'html-editor-source-toggle--active' : ''}`}
            onClick={() => switchMode('preview')}
          >
            Render Preview
          </button>
        </div>
      </div>

      {mode === 'source' && (
        <textarea
          className="html-block-source-textarea"
          value={block.html}
          onChange={handleSourceChange}
          placeholder="Enter raw HTML here..."
          rows={12}
        />
      )}

      {mode === 'visual' && (
        <ReactQuill
          theme="snow"
          value={block.html}
          onChange={handleChange}
          modules={modules}
          formats={QUILL_FORMATS}
          placeholder="Start typing your content here..."
        />
      )}

      {mode === 'preview' && (
        <div className="html-block-preview-pane">
          <SafeHtml html={block.html} enableProse />
        </div>
      )}
    </div>
  )
}
