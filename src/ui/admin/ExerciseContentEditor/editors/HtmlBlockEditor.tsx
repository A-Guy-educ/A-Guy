'use client'

import type { HtmlBlock } from '@/server/payload/collections/Exercises/types'
import { parseHtmlToGuidedExplanation } from '@/infra/contracts/guided-explanation/parseHtmlToGuidedExplanation'
import dynamic from 'next/dynamic'
import React, { useMemo, useRef, useState } from 'react'
import 'react-quill-new/dist/quill.snow.css'

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

interface HtmlBlockEditorProps {
  block: HtmlBlock
  onChange: (block: HtmlBlock) => void
}

export const HtmlBlockEditor: React.FC<HtmlBlockEditorProps> = ({ block, onChange }) => {
  const [showSource, setShowSource] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const modules = useMemo(() => QUILL_MODULES, [])
  const hasGuidedExplanation = !!block.guidedExplanation

  const handleChange = (html: string) => {
    const normalized = html === '<p><br></p>' ? '' : html
    onChange({ ...block, html: normalized })
  }

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...block, html: e.target.value })
  }

  const handleToggleSource = () => {
    // No sanitization — admin content is trusted and DOMPurify restrictions
    // would strip valid tags like style, svg, link, script
    setShowSource(!showSource)
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
        // Not a guided explanation — store HTML as-is without DOMPurify sanitization.
        // Admin content is trusted; restrictions would strip style, svg, link, script, etc.
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
            <button
              type="button"
              className={`html-editor-source-toggle ${showSource ? 'html-editor-source-toggle--active' : ''}`}
              onClick={handleToggleSource}
            >
              {showSource ? 'Visual Editor' : 'HTML Source'}
            </button>
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
      ) : showSource ? (
        <textarea
          className="html-block-source-textarea"
          value={block.html}
          onChange={handleSourceChange}
          placeholder="Enter raw HTML here..."
          rows={12}
        />
      ) : (
        <ReactQuill
          theme="snow"
          value={block.html}
          onChange={handleChange}
          modules={modules}
          formats={QUILL_FORMATS}
          placeholder="Start typing your content here..."
        />
      )}
    </div>
  )
}
