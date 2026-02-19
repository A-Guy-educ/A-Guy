'use client'

import type { HtmlBlock } from '@/shared/exercise-content/types'
import dynamic from 'next/dynamic'
import React, { useMemo, useState } from 'react'

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

interface HtmlBlockEditorProps {
  block: HtmlBlock
  onChange: (block: HtmlBlock) => void
  /** Locale controls text direction. 'he' → dir="rtl", 'en' → dir="ltr". */
  locale?: 'he' | 'en'
}

export const HtmlBlockEditor: React.FC<HtmlBlockEditorProps> = ({ block, onChange, locale }) => {
  const [showSource, setShowSource] = useState(false)
  const dir = locale === 'he' ? 'rtl' : 'ltr'

  // useMemo: stable references prevent Quill from destroying/recreating the
  // editor instance on every parent re-render (which resets cursor position).
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'code-block'],
        ['link', 'image'],
        [{ direction: 'rtl' }], // RTL direction toggle button
        [{ align: [] }], // Text alignment (required for RTL/LTR mixing)
        ['clean'],
      ],
    }),
    [],
  )

  const formats = useMemo(
    () => [
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
      'align',
    ],
    [],
  )

  const handleChange = (html: string) => {
    // Normalize Quill's empty state: '<p><br></p>' → ''
    const normalized = html === '<p><br></p>' ? '' : html
    onChange({ ...block, html: normalized })
  }

  return (
    <div className="html-block-editor" dir={dir}>
      <div className="html-block-editor-header">
        <span className="html-block-editor-label">HTML Block</span>
        <button
          type="button"
          className={`html-editor-source-toggle${showSource ? ' html-editor-source-toggle--active' : ''}`}
          onClick={() => setShowSource(!showSource)}
        >
          {showSource ? 'Visual Editor' : 'HTML Source'}
        </button>
      </div>

      {showSource ? (
        <textarea
          className="html-block-source-textarea"
          value={block.html}
          onChange={(e) => onChange({ ...block, html: e.target.value })}
          placeholder="Enter raw HTML here..."
          rows={12}
        />
      ) : (
        <ReactQuill
          theme="snow"
          value={block.html}
          onChange={handleChange}
          modules={modules}
          formats={formats}
          placeholder="Start typing your content here..."
        />
      )}
    </div>
  )
}
