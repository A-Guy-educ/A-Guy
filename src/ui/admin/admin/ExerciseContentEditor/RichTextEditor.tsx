'use client'

import React from 'react'
import { Bold, Italic, Code, Sigma, Heading1, Link as LinkIcon } from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (val: string) => void
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange }) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selection = text.substring(start, end)

    const newValue = text.substring(0, start) + before + selection + after + text.substring(end)

    onChange(newValue)

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar">
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
        className="rich-text-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter markdown content..."
      />

      <div className="rich-text-footer">{value.length} characters</div>
    </div>
  )
}
