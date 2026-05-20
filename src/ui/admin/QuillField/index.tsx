'use client'

import DOMPurify from 'dompurify'
import { useField } from '@payloadcms/ui'
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

// Admin-only — XSS not a risk since only admins input HTML content
const SANITIZE_CONFIG = {}

export const QuillField: React.FC<{ path: string }> = ({ path }) => {
  const { value, setValue } = useField<string>({ path })
  const [showSource, setShowSource] = useState(false)

  const modules = useMemo(() => QUILL_MODULES, [])

  const handleChange = (html: string) => {
    const normalized = html === '<p><br></p>' ? '' : html
    setValue(normalized)
  }

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
  }

  const handleToggleSource = () => {
    if (showSource && value) {
      const sanitized = DOMPurify.sanitize(value, SANITIZE_CONFIG)
      if (sanitized !== value) {
        setValue(sanitized)
      }
    }
    setShowSource(!showSource)
  }

  return (
    <div className="html-block-editor">
      <div className="html-block-editor-header">
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
          value={value || ''}
          onChange={handleSourceChange}
          placeholder="Enter raw HTML here..."
          rows={12}
        />
      ) : (
        <ReactQuill
          theme="snow"
          value={value || ''}
          onChange={handleChange}
          modules={modules}
          formats={QUILL_FORMATS}
          placeholder="Start typing your content here..."
        />
      )}
    </div>
  )
}
