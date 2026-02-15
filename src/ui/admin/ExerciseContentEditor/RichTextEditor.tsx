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

  const insertColor = (
    color: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'gray',
  ) => {
    insertText(`::${color}{`, '}')
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
        <div className="toolbar-button-wrapper" ref={colorPickerRef}>
          <button
            className="toolbar-button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Text Color"
          >
            <Palette size={14} />
          </button>
          {showColorPicker && (
            <div className="color-picker-dropdown">
              <button
                className="color-option color-option--red"
                onClick={() => insertColor('red')}
                title="Red"
              />
              <button
                className="color-option color-option--orange"
                onClick={() => insertColor('orange')}
                title="Orange"
              />
              <button
                className="color-option color-option--yellow"
                onClick={() => insertColor('yellow')}
                title="Yellow"
              />
              <button
                className="color-option color-option--green"
                onClick={() => insertColor('green')}
                title="Green"
              />
              <button
                className="color-option color-option--blue"
                onClick={() => insertColor('blue')}
                title="Blue"
              />
              <button
                className="color-option color-option--purple"
                onClick={() => insertColor('purple')}
                title="Purple"
              />
              <button
                className="color-option color-option--pink"
                onClick={() => insertColor('pink')}
                title="Pink"
              />
              <button
                className="color-option color-option--gray"
                onClick={() => insertColor('gray')}
                title="Gray"
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
