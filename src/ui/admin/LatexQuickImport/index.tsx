'use client'

import { useState } from 'react'
import { parseLatexToBlocks } from '@/lib/latex-parser'
import type { ParseResult } from '@/lib/latex-parser/types'

interface LatexQuickImportProps {
  lessonId?: string
  onImportSuccess?: (exerciseId: string) => void
}

export function LatexQuickImport({ lessonId, onImportSuccess }: LatexQuickImportProps) {
  const [latex, setLatex] = useState('')
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handlePreview() {
    setError(null)
    setSuccess(null)
    const result = parseLatexToBlocks(latex)
    setPreview(result)
    if (result.errors.length > 0) {
      setError(`Dangerous commands found: ${result.errors.map((e) => e.message).join(', ')}`)
    }
  }

  async function handleImport() {
    if (!lessonId || !preview || preview.blocks.length === 0) return
    setImporting(true)
    setError(null)
    try {
      const response = await fetch('/api/exercises/import-latex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex, lessonId }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error || 'Import failed')
        return
      }
      setSuccess(`Exercise created: ${data.data.exerciseId}`)
      onImportSuccess?.(data.data.exerciseId)
      setLatex('')
      setPreview(null)
    } catch {
      setError('Network error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="latex-quick-import">
      <h3 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Import from LaTeX</h3>
      <textarea
        value={latex}
        onChange={(e) => setLatex(e.target.value)}
        placeholder="Paste LaTeX content here..."
        style={{
          width: '100%',
          minHeight: '120px',
          fontFamily: 'monospace',
          fontSize: '12px',
          padding: '8px',
          border: '1px solid var(--theme-elevation-300)',
          borderRadius: '4px',
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          onClick={handlePreview}
          disabled={!latex.trim()}
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            cursor: latex.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Preview
        </button>
        <button
          onClick={handleImport}
          disabled={!preview || preview.blocks.length === 0 || importing || !lessonId}
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            cursor: preview?.blocks.length ? 'pointer' : 'not-allowed',
          }}
        >
          {importing ? 'Importing...' : 'Import as Exercise'}
        </button>
      </div>
      {preview && (
        <div style={{ marginTop: '12px', fontSize: '13px' }}>
          <p>{preview.blocks.length} blocks found</p>
          {preview.warnings.length > 0 && (
            <p style={{ color: 'var(--theme-warning-500)' }}>{preview.warnings.length} warnings</p>
          )}
        </div>
      )}
      {error && (
        <p style={{ color: 'var(--theme-error-500)', marginTop: '8px', fontSize: '13px' }}>
          {error}
        </p>
      )}
      {success && (
        <p style={{ color: 'var(--theme-success-500)', marginTop: '8px', fontSize: '13px' }}>
          {success}
        </p>
      )}
    </div>
  )
}
