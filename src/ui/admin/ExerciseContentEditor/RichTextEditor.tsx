'use client'

import React from 'react'
import { Bold, Italic, Code, Sigma, Heading1, Link as LinkIcon, Palette } from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (val: string) => void
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange }) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [showColorPicker, setShowColorPicker] = React.useState(false)
  const colorPickerRef = React.useRef<HTMLDivElement>(null)

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

  const insertHighlight = (highlight: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) => {
    insertText(`::text-highlight-${highlight}{`, '}')
    setShowColorPicker(false)
  }

  // Click-outside handler
  React.useEffect(() => {
    if (!showColorPicker) return

    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showColorPicker])

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar">
        <button
          type="button"
          className="toolbar-button"
          onClick={() => insertText('**', '**')}
          title="Bold"
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={() => insertText('*', '*')}
          title="Italic"
        >
          <Italic size={14} />
        </button>
        <div className="toolbar-divider" />
        <button
          type="button"
          className="toolbar-button"
          onClick={() => insertText('# ')}
          title="Heading"
        >
          <Heading1 size={14} />
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={() => insertText('`', '`')}
          title="Code"
        >
          <Code size={14} />
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={() => insertText('$', '$')}
          title="Math (Inline)"
        >
          <Sigma size={14} />
        </button>
        <div className="toolbar-divider" />
        <button
          type="button"
          className="toolbar-button"
          onClick={() => insertText('[', '](url)')}
          title="Link"
        >
          <LinkIcon size={14} />
        </button>
        <div className="toolbar-button-wrapper" ref={colorPickerRef}>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Text Color"
          >
            <Palette size={14} />
          </button>
          {showColorPicker && (
            <div className="color-picker-dropdown">
              <button
                type="button"
                className="color-option color-option--highlight-1"
                onClick={() => insertHighlight(1)}
                title="Highlight 1 (Red)"
              />
              <button
                type="button"
                className="color-option color-option--highlight-2"
                onClick={() => insertHighlight(2)}
                title="Highlight 2 (Orange)"
              />
              <button
                type="button"
                className="color-option color-option--highlight-3"
                onClick={() => insertHighlight(3)}
                title="Highlight 3 (Yellow)"
              />
              <button
                type="button"
                className="color-option color-option--highlight-4"
                onClick={() => insertHighlight(4)}
                title="Highlight 4 (Green)"
              />
              <button
                type="button"
                className="color-option color-option--highlight-5"
                onClick={() => insertHighlight(5)}
                title="Highlight 5 (Blue)"
              />
              <button
                type="button"
                className="color-option color-option--highlight-6"
                onClick={() => insertHighlight(6)}
                title="Highlight 6 (Purple)"
              />
              <button
                type="button"
                className="color-option color-option--highlight-7"
                onClick={() => insertHighlight(7)}
                title="Highlight 7 (Pink)"
              />
              <button
                type="button"
                className="color-option color-option--highlight-8"
                onClick={() => insertHighlight(8)}
                title="Highlight 8 (Gray)"
              />
            </div>
          )}
        </div>
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
