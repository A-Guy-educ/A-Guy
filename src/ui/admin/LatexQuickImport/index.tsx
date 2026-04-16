'use client'

import { useState } from 'react'

interface LatexQuickImportProps {
  lessonId: string
  onImportSuccess?: () => void
}

interface UnifiedImportResponse {
  success: boolean
  method?: 'script' | 'ai_fallback'
  data?: {
    exerciseIds: string[]
    exerciseCount: number
    warnings?: { line: number; message: string; rawLatex: string }[]
  }
  error?: string
  errors?: { line: number; message: string; rawLatex: string }[]
}

export function LatexQuickImport({ lessonId, onImportSuccess }: LatexQuickImportProps) {
  const [latex, setLatex] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  async function handleImport() {
    if (!latex.trim()) return
    setImporting(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/exercises/import-latex-unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex, lessonId }),
        credentials: 'include',
      })
      const data = (await response.json()) as UnifiedImportResponse
      if (!response.ok || !data.success) {
        setError(data.error || data.errors?.[0]?.message || 'Import failed')
        return
      }
      const methodLabel = data.method === 'ai_fallback' ? ' via AI fallback' : ''
      const warnings = data.data?.warnings
      const warnText = warnings?.length
        ? ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})`
        : ''
      setSuccess(`${data.data?.exerciseCount ?? 0} exercise(s) created${methodLabel}${warnText}`)
      onImportSuccess?.()
      setLatex('')
    } catch {
      setError('Network error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <textarea
        value={latex}
        onChange={(e) => {
          setLatex(e.target.value)
          setSuccess(null)
        }}
        placeholder="Paste LaTeX content here..."
        style={{
          width: '100%',
          minHeight: '100px',
          fontFamily: 'monospace',
          fontSize: '12px',
          padding: '8px',
          border: '1px solid var(--theme-elevation-300)',
          borderRadius: '4px',
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={handleImport}
          disabled={!latex.trim() || importing}
          type="button"
          style={{
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: !latex.trim() || importing ? 'not-allowed' : 'pointer',
            border: 'none',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-900)',
            color: 'var(--theme-elevation-0)',
          }}
        >
          {importing ? 'Importing...' : 'Import LaTeX'}
        </button>
        <button
          onClick={() => setShowPreview((v) => !v)}
          disabled={!latex.trim()}
          type="button"
          style={{
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: !latex.trim() ? 'not-allowed' : 'pointer',
            border: '1px solid var(--theme-elevation-300)',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-0)',
            color: 'var(--theme-elevation-800)',
          }}
        >
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>
      {showPreview && latex.trim() && (
        <pre
          aria-label="LaTeX preview"
          style={{
            marginTop: 8,
            padding: 8,
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: 4,
            backgroundColor: 'var(--theme-elevation-50)',
            fontSize: 11,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 220,
            overflow: 'auto',
            color: 'var(--theme-elevation-900)',
          }}
        >
          {latex}
        </pre>
      )}
      {error && (
        <p style={{ color: 'var(--theme-error-500)', marginTop: '8px', fontSize: '12px' }}>
          {error}
        </p>
      )}
      {success && (
        <p style={{ color: 'var(--theme-success-500)', marginTop: '8px', fontSize: '12px' }}>
          {success}
        </p>
      )}
    </div>
  )
}
