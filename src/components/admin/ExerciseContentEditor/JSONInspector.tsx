'use client'

import React from 'react'
import { Copy, Edit, X, Check, RotateCcw, AlignLeft } from 'lucide-react'
import { Highlight, themes } from 'prism-react-renderer'
import type { ContentBlock } from '@/collections/Exercises'
import { ContentBlockSchema } from '@/collections/Exercises'

interface JSONInspectorProps {
  block: ContentBlock | null // Selected block
  mode: 'read' | 'edit'
  onApply?: (block: ContentBlock) => void // Called when Apply is clicked
  onClose?: () => void // For mobile toggle
}

export const JSONInspector: React.FC<JSONInspectorProps> = ({ block, mode, onApply, onClose }) => {
  const [copied, setCopied] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  const [editValue, setEditValue] = React.useState('')
  const [editError, setEditError] = React.useState<string | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const preRef = React.useRef<HTMLPreElement>(null)

  const jsonString = block ? JSON.stringify(block, null, 2) : null

  // Sync scroll position between textarea and overlay
  const handleScroll = React.useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  // Initialize edit value when entering edit mode
  React.useEffect(() => {
    if (isEditing && block) {
      setEditValue(JSON.stringify(block, null, 2))
      setEditError(null)
    }
  }, [isEditing, block])

  const handleCopy = async () => {
    if (!jsonString) return
    try {
      await navigator.clipboard.writeText(jsonString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy JSON:', err)
    }
  }

  const validateJSON = (
    jsonStr: string,
  ): { valid: boolean; error?: string; data?: ContentBlock } => {
    // Try JSON.parse first
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonStr)
    } catch (err) {
      return {
        valid: false,
        error: `Invalid JSON: ${err instanceof Error ? err.message : 'Parse error'}`,
      }
    }

    // Try Zod schema validation (validates all block types)
    const result = ContentBlockSchema.safeParse(parsed)
    if (!result.success) {
      const firstError = result.error.issues[0]
      const path = firstError.path.join('.')
      return {
        valid: false,
        error: `Schema validation error at ${path}: ${firstError.message}`,
      }
    }

    return { valid: true, data: result.data }
  }

  const handleApply = () => {
    if (!onApply) return

    const validation = validateJSON(editValue)
    if (!validation.valid || !validation.data) {
      setEditError(validation.error || 'Unknown validation error')
      return
    }

    onApply(validation.data)
    setIsEditing(false)
    setEditError(null)
  }

  const handleRevert = () => {
    if (block) {
      setEditValue(JSON.stringify(block, null, 2))
    }
    setEditError(null)
  }

  const handleFormat = () => {
    const validation = validateJSON(editValue)
    if (validation.valid && validation.data) {
      setEditValue(JSON.stringify(validation.data, null, 2))
      setEditError(null)
    } else {
      // Try to parse and reformat even if invalid (might help with syntax errors)
      try {
        const parsed = JSON.parse(editValue)
        setEditValue(JSON.stringify(parsed, null, 2))
      } catch {
        // If can't parse, show error
        setEditError(validation.error || 'Cannot format invalid JSON')
      }
    }
  }

  if (!block) {
    return (
      <div className="json-inspector json-inspector--empty">
        <div className="json-inspector__empty-state">
          <p>Select a block to view JSON</p>
        </div>
      </div>
    )
  }

  return (
    <div className="json-inspector">
      <div className="json-inspector__header">
        <div className="json-inspector__title">
          <span>{isEditing ? 'JSON Edit' : 'JSON View'}</span>
          <span className="json-inspector__block-type">{block.type}</span>
        </div>
        <div className="json-inspector__actions">
          {!isEditing ? (
            <>
              <button
                className="icon-button"
                onClick={handleCopy}
                title={copied ? 'Copied!' : 'Copy JSON'}
              >
                <Copy size={14} />
              </button>
              {mode === 'edit' && (
                <button
                  className="icon-button"
                  onClick={() => setIsEditing(true)}
                  title="Edit JSON"
                >
                  <Edit size={14} />
                </button>
              )}
              {onClose && (
                <button className="icon-button" onClick={onClose} title="Close">
                  <X size={14} />
                </button>
              )}
            </>
          ) : (
            <>
              <button className="icon-button" onClick={handleFormat} title="Format JSON">
                <AlignLeft size={14} />
              </button>
              <button className="icon-button" onClick={handleRevert} title="Revert Changes">
                <RotateCcw size={14} />
              </button>
              <button
                className="icon-button json-inspector__apply"
                onClick={handleApply}
                title="Apply Changes"
              >
                <Check size={14} />
              </button>
              <button
                className="icon-button"
                onClick={() => {
                  setIsEditing(false)
                  setEditError(null)
                  handleRevert()
                }}
                title="Cancel"
              >
                <X size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      {editError && (
        <div className="json-inspector__error">
          <p>{editError}</p>
        </div>
      )}
      <div className="json-inspector__content">
        {isEditing ? (
          <div className="json-inspector__editor">
            <Highlight theme={themes.vsDark} code={editValue} language="json">
              {({ style, tokens, getLineProps, getTokenProps }) => (
                <pre
                  ref={preRef}
                  className="json-inspector__pre json-inspector__pre--overlay"
                  style={{ ...style, background: '#1e1e1e' }}
                >
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
            <textarea
              ref={textareaRef}
              className="json-inspector__textarea json-inspector__textarea--editable"
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value)
                setEditError(null)
              }}
              onScroll={handleScroll}
              spellCheck={false}
            />
          </div>
        ) : jsonString ? (
          <Highlight theme={themes.vsDark} code={jsonString} language="json">
            {({ style, tokens, getLineProps, getTokenProps }) => (
              <pre className="json-inspector__pre" style={{ ...style, background: '#1e1e1e' }}>
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })}>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        ) : null}
      </div>
    </div>
  )
}
