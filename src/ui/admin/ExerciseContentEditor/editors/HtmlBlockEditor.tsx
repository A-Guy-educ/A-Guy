'use client'

import type { HtmlBlock } from '@/server/payload/collections/Exercises/types'
import { HTML_BLOCK_PURIFY_CONFIG } from '@/lib/sanitize/config'
import DOMPurify from 'dompurify'
import dynamic from 'next/dynamic'
import React, { useMemo, useState } from 'react'
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

  // Memoize to prevent Quill re-initialization on re-render
  const modules = useMemo(() => QUILL_MODULES, [])

  const handleChange = (html: string) => {
    const normalized = html === '<p><br></p>' ? '' : html
    onChange({ ...block, html: normalized })
  }

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...block, html: e.target.value })
  }

  const handleToggleSource = () => {
    // Sanitize when leaving source view to strip any dangerous content pasted as raw HTML
    if (showSource && block.html) {
      const sanitized = DOMPurify.sanitize(block.html, HTML_BLOCK_PURIFY_CONFIG)
      if (sanitized !== block.html) {
        onChange({ ...block, html: sanitized as string })
      }
    }
    setShowSource(!showSource)
  }

  return (
    <div className="html-block-editor">
      <div className="html-block-editor-header">
        <span className="html-block-editor-label">HTML Block</span>
        <button
          type="button"
          className={`html-editor-source-toggle ${showSource ? 'html-editor-source-toggle--active' : ''}`}
          onClick={handleToggleSource}
        >
          {showSource ? 'Visual Editor' : 'HTML Source'}
        </button>
      </div>

      {showSource ? (
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
