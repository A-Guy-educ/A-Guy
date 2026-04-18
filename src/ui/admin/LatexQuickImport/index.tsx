'use client'

import { useState } from 'react'

interface LatexQuickImportProps {
  lessonId: string
  onImportSuccess?: () => void
}

export function LatexQuickImport({ lessonId, onImportSuccess }: LatexQuickImportProps) {
  const [latex, setLatex] = useState('')
  const [importing, setImporting] = useState(false)
  const [importingAi, setImportingAi] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleScriptImport() {
    if (!latex.trim()) return
    setImporting(true)
    setError(null)
    try {
      const response = await fetch('/api/exercises/import-latex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex, lessonId }),
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error || data.errors?.[0]?.message || 'Import failed')
        return
      }
      setSuccess(`${data.data.exerciseCount} exercise(s) created`)
      onImportSuccess?.()
      setLatex('')
    } catch {
      setError('Network error')
    } finally {
      setImporting(false)
    }
  }

  async function handleAiImport() {
    if (!latex.trim()) return
    setImportingAi(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/exercises/import-latex-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex, lessonId }),
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error || 'AI import failed')
        return
      }
      const warnings = data.data.warnings
      const warnText = warnings?.length ? ` (${warnings.length} failed)` : ''
      setSuccess(`${data.data.exerciseCount} exercise(s) created via AI${warnText}`)
      onImportSuccess?.()
      setLatex('')
    } catch {
      setError('Network error')
    } finally {
      setImportingAi(false)
    }
  }

  const busy = importing || importingAi

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
          onClick={handleScriptImport}
          disabled={!latex.trim() || busy}
          type="button"
          style={{
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: !latex.trim() || busy ? 'not-allowed' : 'pointer',
            border: 'none',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-900)',
            color: 'var(--theme-elevation-0)',
          }}
        >
          {importing ? 'Importing...' : 'Import (Script)'}
        </button>
        <button
          onClick={handleAiImport}
          disabled={!latex.trim() || busy}
          type="button"
          style={{
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: !latex.trim() || busy ? 'not-allowed' : 'pointer',
            border: 'none',
            borderRadius: 3,
            backgroundColor: '#7c3aed',
            color: '#fff',
          }}
        >
          {importingAi ? 'AI Processing...' : 'Import (AI)'}
        </button>
      </div>
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
