'use client'

import React from 'react'
import type { InlineRichText } from '@/shared/exercise-content/types'
import { Bold, Italic, Code, Sigma, Heading1, Link as LinkIcon } from 'lucide-react'

interface InlineRichTextEditorProps {
  value: InlineRichText
  onChange: (value: InlineRichText) => void
  placeholder?: string
  minHeight?: string
}

export const InlineRichTextEditor: React.FC<InlineRichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter text...',
  minHeight = '80px',
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selection = text.substring(start, end)

    const newValue = text.substring(0, start) + before + selection + after + text.substring(end)

    onChange({ ...value, value: newValue })

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }

  return (
    <div className="inline-rich-text-editor">
      <div className="inline-rich-text-toolbar">
        <button className="toolbar-button" onClick={() => insertText('**', '**')} title="Bold">
          <Bold size={14} />
        </button>
        <button className="toolbar-button" onClick={() => insertText('*', '*')} title="Italic">
          <Italic size={14} />
        </button>
        <div className="toolbar-divider" />
        <button className="toolbar-button" onClick={() => insertText('# ')} title="Heading">
          <Heading1 size={14} />
        </button>
        <button className="toolbar-button" onClick={() => insertText('`', '`')} title="Code">
          <Code size={14} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => insertText('$', '$')}
          title="Math (Inline)"
        >
          <Sigma size={14} />
        </button>
        <div className="toolbar-divider" />
        <button className="toolbar-button" onClick={() => insertText('[', '](url)')} title="Link">
          <LinkIcon size={14} />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        className="inline-rich-text-textarea"
        style={{ minHeight }}
        value={value.value}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
        placeholder={placeholder}
      />

      <div className="inline-rich-text-footer">{value.value.length} characters</div>
    </div>
  )
}
