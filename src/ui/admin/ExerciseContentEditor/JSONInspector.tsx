'use client'

import type { ContentBlock } from '@/server/payload/collections/Exercises/types'
import { validateStructuralInvariance } from '@/utils/structure-validator'
import { AlignLeft, Check, Copy, Edit, RotateCcw, X } from 'lucide-react'
import { Highlight, themes } from 'prism-react-renderer'
import React from 'react'

// All valid block types (11 total)
const VALID_BLOCK_TYPES = [
  'rich_text',
  'question_select',
  'question_free_response',
  'question_table',
  'latex',
  'question_matching',
  'svg',
  'question_geometry',
  'question_axis',
  'html',
  'media',
] as const

type ValidBlockType = (typeof VALID_BLOCK_TYPES)[number]

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
    originalBlock: ContentBlock | null,
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

    // Basic structure validation (full schema validation happens on server)
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Expected object' }
    }

    const obj = parsed as Record<string, unknown>
    if (!obj.type || typeof obj.type !== 'string') {
      return { valid: false, error: 'Missing or invalid "type" field' }
    }

    // Validate based on block type - check against ALL valid types
    if (!VALID_BLOCK_TYPES.includes(obj.type as ValidBlockType)) {
      return { valid: false, error: `Invalid block type: ${obj.type}` }
    }

    // Structure invariance validation - compare against original block
    if (originalBlock) {
      const structureResult = validateStructuralInvariance(originalBlock, parsed)
      if (!structureResult.valid) {
        const firstError = structureResult.errors[0]
        const errorMessage = firstError
          ? `Structure change not allowed: ${firstError.path || 'root'} — ${firstError.message}`
          : 'Structure change not allowed'
        return {
          valid: false,
          error: errorMessage,
        }
      }
    }

    // Return the parsed data as ContentBlock
    return { valid: true, data: parsed as ContentBlock }
  }

  const handleApply = () => {
    if (!onApply) return

    const validation = validateJSON(editValue, block)
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
    const validation = validateJSON(editValue, block)
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
