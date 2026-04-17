'use client'

import { useState } from 'react'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { PRODUCT_EVENTS } from '@/infra/analytics/contracts/events'
import { analytics } from '@/infra/analytics/core/tracker'

interface LatexQuickImportProps {
  lessonId: string
  onImportSuccess?: () => void
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
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error || data.errors?.[0]?.message || 'Import failed')
        return
      }

      // Track analytics if AI fallback was used
      if (data.data.method === 'ai_fallback') {
        analytics.track(PRODUCT_EVENTS.LATEX_IMPORT_FALLBACK, {
          lessonId,
          scriptErrors: data.data.scriptErrors || [],
          aiSucceeded: true,
        })
      }

      const methodText = data.data.method === 'ai_fallback' ? ' (AI fallback)' : ''
      setSuccess(`${data.data.exerciseCount} exercise(s) created${methodText}`)
      onImportSuccess?.()
      setLatex('')
      setShowPreview(false)
    } catch {
      setError('Network error')
    } finally {
      setImporting(false)
    }
  }

  const busy = importing

  return (
    <div style={{ marginTop: 8 }}>
      <textarea
        value={latex}
        onChange={(e) => {
          setLatex(e.target.value)
          setSuccess(null)
          setShowPreview(e.target.value.trim().length > 0)
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

      {/* Inline LaTeX preview */}
      {showPreview && latex.trim() && (
        <div
          style={{
            marginTop: '8px',
            padding: '12px',
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: '4px',
            backgroundColor: 'var(--theme-elevation-0)',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: 'var(--theme-elevation-600)',
              marginBottom: '8px',
              fontWeight: 500,
            }}
          >
            Preview:
          </div>
          <div style={{ fontSize: '12px' }}>
            <MathMarkdown content={`$$\n${latex}\n$$`} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={handleImport}
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
          {importing ? 'Importing...' : 'Import'}
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