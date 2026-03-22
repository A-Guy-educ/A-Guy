'use client'

import { useState } from 'react'
import { parseLatexToExercises } from '@/lib/latex-parser'
import type { MultiExerciseResult } from '@/lib/latex-parser/types'

interface LatexQuickImportProps {
  lessonId: string
  onImportSuccess?: () => void
}

export function LatexQuickImport({ lessonId, onImportSuccess }: LatexQuickImportProps) {
  const [latex, setLatex] = useState('')
  const [preview, setPreview] = useState<MultiExerciseResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [importingAi, setImportingAi] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handlePreview() {
    setError(null)
    setSuccess(null)
    const result = parseLatexToExercises(latex)
    setPreview(result)
    if (result.errors.length > 0) {
      setError(`Dangerous commands found: ${result.errors.map((e) => e.message).join(', ')}`)
    }
  }

  async function handleScriptImport() {
    if (!preview || preview.exercises.length === 0) return
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
      setPreview(null)
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
      setSuccess(`${data.data.exerciseCount} exercise(s) created via AI`)
      onImportSuccess?.()
      setLatex('')
      setPreview(null)
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
          setPreview(null)
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
          onClick={handlePreview}
          disabled={!latex.trim() || busy}
          type="button"
          style={{
            padding: '5px 10px',
            fontSize: '12px',
            cursor: !latex.trim() || busy ? 'not-allowed' : 'pointer',
            border: '1px solid var(--theme-elevation-300)',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-0)',
            color: 'var(--theme-elevation-800)',
          }}
        >
          Preview
        </button>
        <button
          onClick={handleScriptImport}
          disabled={!preview || preview.exercises.length === 0 || busy}
          type="button"
          style={{
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: !preview?.exercises.length || busy ? 'not-allowed' : 'pointer',
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
      {preview && !error && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--theme-elevation-600)' }}>
          {preview.exercises.length} exercise(s) detected
          {preview.exercises.map((ex, i) => (
            <span key={i}>
              {i === 0 ? ': ' : ', '}
              {ex.title || `Untitled`} ({ex.blocks.length} blocks)
            </span>
          ))}
          {preview.warnings.length > 0 && (
            <span style={{ color: 'var(--theme-warning-500)' }}>
              {' '}
              | {preview.warnings.length} warning(s)
            </span>
          )}
        </div>
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
