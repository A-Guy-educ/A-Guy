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

/**
 * Tags Quill can round-trip without data loss. Anything outside this set
 * (e.g. <details>, <dialog>, <button>, <section>, inline `style="..."`)
 * gets stripped or rewritten when Quill imports the HTML, so we refuse
 * to switch into Visual mode and force the author to stay in Source.
 */
const QUILL_SAFE_TAGS = new Set([
  'p',
  'br',
  'span',
  'h1',
  'h2',
  'h3',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ol',
  'ul',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'img',
])

function htmlIsQuillSafe(html: string): boolean {
  if (!html) return true
  // Reject any inline style attribute — Quill drops them.
  if (/\sstyle\s*=/i.test(html)) return false
  const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
  let match
  while ((match = tagPattern.exec(html)) !== null) {
    if (!QUILL_SAFE_TAGS.has(match[1].toLowerCase())) return false
  }
  return true
}

interface HtmlBlockEditorProps {
  block: HtmlBlock
  onChange: (block: HtmlBlock) => void
}

export const HtmlBlockEditor: React.FC<HtmlBlockEditorProps> = ({ block, onChange }) => {
  // Default to Source mode when the existing content has advanced HTML —
  // dropping authors into Visual would silently destroy their markup.
  const [mode, setMode] = useState<EditorMode>(() =>
    htmlIsQuillSafe(block.html) ? 'visual' : 'source',
  )

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
    // Block switching to Visual when content has advanced HTML — Quill would
    // strip styles, <details>, <dialog>, <button>, etc. and silently destroy
    // the author's work. Force them back to Source instead.
    if (next === 'visual' && !htmlIsQuillSafe(block.html)) {
      window.alert(
        'This block uses advanced HTML (inline styles, <details>, <dialog>, <button>, ' +
          'or other tags Quill cannot represent). Visual mode would discard those ' +
          'features, so it stays disabled. Use HTML Source to edit and Render Preview ' +
          'to verify the result.',
      )
      return
    }
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

  const visualDisabled = !htmlIsQuillSafe(block.html)

  return (
    <div className="html-block-editor">
      <div className="html-block-editor-header">
        <span className="html-block-editor-label">HTML Block</span>
        <div className="html-block-editor-mode-switch">
          <button
            type="button"
            className={`html-editor-source-toggle ${mode === 'visual' ? 'html-editor-source-toggle--active' : ''}`}
            onClick={() => switchMode('visual')}
            disabled={visualDisabled}
            title={
              visualDisabled
                ? 'Visual editor disabled — content uses advanced HTML Quill cannot render.'
                : undefined
            }
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
