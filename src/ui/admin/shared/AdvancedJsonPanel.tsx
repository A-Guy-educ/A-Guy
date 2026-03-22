'use client'

/**
 * Advanced JSON panel with structure validation for exercise blocks
 */

import { validateStructuralInvariance } from '@/utils/structure-validator'
import React from 'react'
import { CollapsibleSection } from './CollapsibleSection'

interface AdvancedJsonPanelProps {
  value: unknown
  onChange?: (value: unknown) => void
  label?: string
  readonly?: boolean
  /** Original value for structure comparison - if provided, structural changes are blocked */
  originalValue?: unknown
}

export function AdvancedJsonPanel({
  value,
  onChange,
  label = 'Advanced: JSON',
  readonly = false,
  originalValue,
}: AdvancedJsonPanelProps) {
  const jsonString = JSON.stringify(value, null, 2)
  const [editingJson, setEditingJson] = React.useState(jsonString)
  const [jsonError, setJsonError] = React.useState<string | null>(null)
  const [structureError, setStructureError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setEditingJson(JSON.stringify(value, null, 2))
  }, [value])

  const handleJsonChange = (newJson: string) => {
    setEditingJson(newJson)
    setJsonError(null)
    setStructureError(null)

    if (readonly || !onChange) return

    try {
      const parsed = JSON.parse(newJson)

      // If originalValue is provided, validate structure invariance
      if (originalValue !== undefined) {
        const structureResult = validateStructuralInvariance(originalValue, parsed)
        if (!structureResult.valid) {
          const firstError = structureResult.errors[0]
          const errorMessage = firstError
            ? `Structure change not allowed: ${firstError.path || 'root'} — ${firstError.message}`
            : 'Structure change not allowed'
          setStructureError(errorMessage)
          // Don't call onChange - block the structural change
          return
        }
      }

      // Only call onChange if JSON is valid AND structure is preserved
      onChange(parsed)
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON')
      // Don't call onChange on parse error
    }
  }

  return (
    <CollapsibleSection title={label} defaultExpanded={false}>
      <div>
        <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', opacity: 0.7 }}>
          {readonly
            ? 'View the generated JSON specification (read-only)'
            : 'Edit the raw JSON directly (for advanced users only)'}
        </p>
        <textarea
          value={editingJson}
          onChange={(e) => handleJsonChange(e.target.value)}
          readOnly={readonly}
          style={{
            width: '100%',
            height: '16rem',
            padding: '0.75rem',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
          }}
          spellCheck={false}
        />
        {(jsonError || structureError) && (
          <div className="field-error" style={{ marginTop: '0.5rem' }}>
            {jsonError || structureError}
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
