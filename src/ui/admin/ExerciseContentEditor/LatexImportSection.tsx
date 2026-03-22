'use client'

import { LatexQuickImport } from '@/ui/admin/LatexQuickImport'
import { useFormFields } from '@payloadcms/ui'
import React from 'react'

export function LatexImportSection() {
  const [showLatexImport, setShowLatexImport] = React.useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lessonField = useFormFields(([fields]) => fields['lesson'] as any)
  const lessonId: string | undefined =
    typeof lessonField?.value === 'string'
      ? lessonField.value
      : typeof lessonField?.value?.id === 'string'
        ? lessonField.value.id
        : undefined

  if (!lessonId) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', color: 'var(--theme-elevation-500)' }}>
          Save exercise with a lesson first to enable LaTeX import.
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <button
        onClick={() => setShowLatexImport(!showLatexImport)}
        style={{
          fontSize: '13px',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          padding: 0,
        }}
        type="button"
      >
        {showLatexImport ? '\u25BC' : '\u25B6'} Import from LaTeX
      </button>
      {showLatexImport && (
        <div style={{ marginTop: '8px' }}>
          <LatexQuickImport
            lessonId={lessonId}
            onImportSuccess={() => {
              window.location.reload()
            }}
          />
        </div>
      )}
    </div>
  )
}
