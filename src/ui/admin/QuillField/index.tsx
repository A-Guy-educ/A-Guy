'use client'

/**
 * @fileType component
 * @ai-summary Quill HTML editor for HtmlBlock - admin-only content creation
 *
 * SECURITY NOTE: This component is admin-only - only authorized content creators (teachers)
 * have access to it. The content is not sanitized here to allow rich HTML including
 * style attributes, details/summary tags, and other HTML. Content displayed to students
 * goes through separate rendering logic with proper escaping.
 */

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
    // No sanitization - admin-only content, rich HTML allowed
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
