'use client'

import { useState } from 'react'
import { LatexQuickImport } from '@/ui/admin/LatexQuickImport'

interface LatexImportSectionProps {
  lessonId: string
}

export function LatexImportSection({ lessonId }: LatexImportSectionProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        marginTop: 8,
        padding: 8,
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 4,
        backgroundColor: 'var(--theme-elevation-0)',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        type="button"
        style={{
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'var(--theme-elevation-800)',
        }}
      >
        {expanded ? '\u25BC' : '\u25B6'} Import from LaTeX
      </button>
      {expanded && <LatexQuickImport lessonId={lessonId} onImportSuccess={() => {}} />}
    </div>
  )
}

export default LatexImportSection
