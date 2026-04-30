'use client'

import { useState } from 'react'

interface FullConvertLatexButtonProps {
  lessonId: string
  mediaId: string
  filename: string
}

/**
 * One-click "Full Convert (LaTeX)" button. No prompt selection — the
 * LaTeX path uses the deterministic context-exercise parser to split
 * the .tex file into exercises and the LaTeX-block parser (with AI
 * fallback) to convert each exercise into typed blocks.
 */
export function FullConvertLatexButton({
  lessonId,
  mediaId,
  filename,
}: FullConvertLatexButtonProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  async function handleRun() {
    if (
      !confirm(
        `Run Full Convert on ${filename}? This will recreate all context-extraction exercises for this lesson.`,
      )
    ) {
      return
    }
    setIsRunning(true)
    setError(null)
    setSuccess(null)
    setWarnings([])
    try {
      const response = await fetch('/api/lessons/convert-full-latex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, mediaId }),
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error?.message || 'Conversion failed')
      }
      const d = data.data
      setSuccess(
        `Created ${d.exerciseCount} exercises. Converted ${d.latexBlocksConverted}/${d.exerciseCount} LaTeX blocks.`,
      )
      if (Array.isArray(d.warnings)) setWarnings(d.warnings)
      window.dispatchEvent(new Event('context-extraction-updated'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={handleRun}
        disabled={isRunning}
        style={{
          padding: '4px 12px',
          fontSize: 11,
          fontWeight: 500,
          border: 'none',
          borderRadius: 3,
          backgroundColor: isRunning ? 'var(--theme-elevation-400)' : 'var(--theme-success)',
          color: 'var(--theme-elevation-0)',
          cursor: isRunning ? 'not-allowed' : 'pointer',
        }}
      >
        {isRunning ? 'Running...' : 'Full Convert (LaTeX)'}
      </button>

      {error && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--theme-error)',
            padding: '4px 8px',
            backgroundColor: 'var(--theme-error-100)',
            borderRadius: 3,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--theme-success)',
            padding: '4px 8px',
            backgroundColor: 'var(--theme-success-100)',
            borderRadius: 3,
          }}
        >
          {success}
        </div>
      )}

      {warnings.length > 0 && (
        <details style={{ fontSize: 11, color: 'var(--theme-elevation-700)' }}>
          <summary style={{ cursor: 'pointer' }}>{warnings.length} warning(s)</summary>
          <ul style={{ marginTop: 4, paddingLeft: 16 }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export default FullConvertLatexButton
