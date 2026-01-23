'use client'

/**
 * Advanced JSON panel for debugging
 */

import React from 'react'
import { CollapsibleSection } from './CollapsibleSection'

interface AdvancedJsonPanelProps {
  value: unknown
  onChange?: (value: unknown) => void
  label?: string
  readonly?: boolean
}

export function AdvancedJsonPanel({
  value,
  onChange,
  label = 'Advanced: JSON',
  readonly = false,
}: AdvancedJsonPanelProps) {
  const jsonString = JSON.stringify(value, null, 2)
  const [editingJson, setEditingJson] = React.useState(jsonString)
  const [jsonError, setJsonError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setEditingJson(JSON.stringify(value, null, 2))
  }, [value])

  const handleJsonChange = (newJson: string) => {
    setEditingJson(newJson)
    setJsonError(null)

    if (readonly || !onChange) return

    try {
      const parsed = JSON.parse(newJson)
      onChange(parsed)
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON')
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
        {jsonError && (
          <div className="field-error" style={{ marginTop: '0.5rem' }}>
            {jsonError}
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
