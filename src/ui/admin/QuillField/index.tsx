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

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'hr',
    'span',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'del',
    'ins',
    'mark',
    'sub',
    'sup',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'code',
    'a',
    'img',
    'div',
    'section',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  ALLOWED_ATTR: [
    'href',
    'src',
    'alt',
    'title',
    'class',
    'id',
    'rel',
    'width',
    'height',
    'colspan',
    'rowspan',
    'dir',
  ],
}

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
