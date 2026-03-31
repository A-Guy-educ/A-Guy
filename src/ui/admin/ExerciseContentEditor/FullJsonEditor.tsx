'use client'

/**
 * Full JSON Editor for Exercise Content
 *
 * Provides a full-content JSON editor that operates on the entire content object.
 * Validates structural invariance before allowing saves to prevent schema breakage.
 */

import { validateStructuralInvariance } from '@/utils/structure-validator'
import { FileCode, RotateCcw, X } from 'lucide-react'
import React from 'react'

interface FullJsonEditorProps {
  /** Current content value */
  content: unknown
  /** Original content (baseline for structural comparison) */
  originalContent: unknown
  /** Callback when changes are applied */
  onApply: (content: unknown) => void
  /** Callback when cancelled */
  onCancel: () => void
}

/**
 * Safely parse JSON with better error handling
 */
function safeJsonParse(
  text: string,
): { success: true; data: unknown } | { success: false; error: string } {
  try {
    const data = JSON.parse(text)
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Invalid JSON' }
  }
}

// Note: ContentSchema (Zod) validation is enforced server-side via the
// collection's validate function and the enforceContentStructure hook.
// Client-side only validates JSON syntax and structural invariance.

export function FullJsonEditor({
  content,
  originalContent,
  onApply,
  onCancel,
}: FullJsonEditorProps) {
  const [jsonText, setJsonText] = React.useState(() => JSON.stringify(content, null, 2))
  const [jsonError, setJsonError] = React.useState<string | null>(null)
  const [structureError, setStructureError] = React.useState<string | null>(null)

  // Update text when content changes externally
  React.useEffect(() => {
    setJsonText(JSON.stringify(content, null, 2))
  }, [content])

  const handleChange = (newText: string) => {
    setJsonText(newText)
    setJsonError(null)
    setStructureError(null)

    // Try to parse JSON
    const parseResult = safeJsonParse(newText)
    if (!parseResult.success) {
      setJsonError(parseResult.error)
      return
    }

    // Validate structure invariance against original
    const structureResult = validateStructuralInvariance(originalContent, parseResult.data)
    if (!structureResult.valid) {
      const firstError = structureResult.errors[0]
      const errorMessage = firstError
        ? `Structure change: ${firstError.path || 'root'} — ${firstError.message}`
        : 'Structure change not allowed'
      setStructureError(errorMessage)
    }
  }

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonText)
      setJsonText(JSON.stringify(parsed, null, 2))
      setJsonError(null)
      setStructureError(null)
    } catch {
      // Ignore formatting errors
    }
  }

  const handleApply = () => {
    const parseResult = safeJsonParse(jsonText)
    if (!parseResult.success) {
      setJsonError(parseResult.error)
      return
    }

    // Final validation
    const structureResult = validateStructuralInvariance(originalContent, parseResult.data)
    if (!structureResult.valid) {
      const firstError = structureResult.errors[0]
      const errorMessage = firstError
        ? `Structure change: ${firstError.path || 'root'} — ${firstError.message}`
        : 'Structure change not allowed'
      setStructureError(errorMessage)
      return
    }

    onApply(parseResult.data)
  }

  const hasErrors = jsonError !== null || structureError !== null
  const canApply = !hasErrors && jsonText.trim().length > 0

  return (
    <div className="full-json-editor">
      <div className="full-json-editor-header">
        <div className="full-json-editor-title">
          <FileCode size={18} />
          <span>Full JSON Editor</span>
        </div>
        <div className="full-json-editor-actions">
          <button
            className="full-json-editor-btn"
            onClick={handleFormat}
            title="Format JSON"
            type="button"
          >
            <RotateCcw size={14} />
            Format
          </button>
          <button
            className="full-json-editor-btn full-json-editor-btn--cancel"
            onClick={onCancel}
            title="Cancel and revert"
            type="button"
          >
            <X size={14} />
            Cancel
          </button>
        </div>
      </div>

      <div className="full-json-editor-info">
        <p>
          Edit the raw JSON directly. Structural changes (adding/removing keys, changing array
          lengths) are not allowed.
        </p>
      </div>

      <textarea
        className="full-json-editor-textarea"
        value={jsonText}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
      />

      {(jsonError || structureError) && (
        <div className="full-json-editor-errors">
          {jsonError && (
            <div className="full-json-editor-error full-json-editor-error--json">{jsonError}</div>
          )}
          {structureError && (
            <div className="full-json-editor-error full-json-editor-error--structure">
              {structureError}
            </div>
          )}
        </div>
      )}

      <div className="full-json-editor-footer">
        <button
          className="full-json-editor-apply-btn"
          onClick={handleApply}
          disabled={!canApply}
          type="button"
        >
          Apply Changes
        </button>
      </div>
    </div>
  )
}
