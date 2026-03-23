'use client'

import { useState } from 'react'

interface TexImportButtonProps {
  lessonId: string
  mediaId: string
  filename: string
}

export function TexImportButton({ lessonId, mediaId, filename }: TexImportButtonProps) {
  const [importing, setImporting] = useState(false)
  const [importingAi, setImportingAi] = useState(false)
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  async function fetchTexContent(): Promise<string | null> {
    try {
      const mediaRes = await fetch(`/api/media/${mediaId}`, { credentials: 'include' })
      if (!mediaRes.ok) {
        setStatus({ type: 'error', message: 'Failed to fetch file info' })
        return null
      }
      const mediaData = await mediaRes.json()
      const url = mediaData.url
      if (!url) {
        setStatus({ type: 'error', message: 'No file URL found' })
        return null
      }
      const fileRes = await fetch(url, { credentials: 'include' })
      if (!fileRes.ok) {
        setStatus({ type: 'error', message: 'Failed to download .tex file' })
        return null
      }
      return await fileRes.text()
    } catch {
      setStatus({ type: 'error', message: 'Failed to fetch .tex file' })
      return null
    }
  }

  async function handleScriptImport() {
    setImporting(true)
    setStatus(null)
    const latex = await fetchTexContent()
    if (!latex) {
      setImporting(false)
      return
    }
    try {
      const response = await fetch('/api/exercises/import-latex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex, lessonId }),
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setStatus({ type: 'error', message: data.error || 'Import failed' })
        return
      }
      setStatus({ type: 'success', message: `${data.data.exerciseCount} exercise(s) created` })
    } catch {
      setStatus({ type: 'error', message: 'Network error' })
    } finally {
      setImporting(false)
    }
  }

  async function handleAiImport() {
    setImportingAi(true)
    setStatus(null)
    const latex = await fetchTexContent()
    if (!latex) {
      setImportingAi(false)
      return
    }
    try {
      const response = await fetch('/api/exercises/import-latex-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex, lessonId }),
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setStatus({ type: 'error', message: data.error || 'AI import failed' })
        return
      }
      const warnings = data.data.warnings
      const warnText = warnings?.length ? ` (${warnings.length} failed)` : ''
      setStatus({
        type: 'success',
        message: `${data.data.exerciseCount} exercise(s) created via AI${warnText}`,
      })
    } catch {
      setStatus({ type: 'error', message: 'Network error' })
    } finally {
      setImportingAi(false)
    }
  }

  const busy = importing || importingAi

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={handleScriptImport}
          disabled={busy}
          type="button"
          title={`Import ${filename} using script parser`}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 500,
            border: 'none',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-900)',
            color: 'var(--theme-elevation-0)',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {importing ? 'Importing...' : 'Import (Script)'}
        </button>
        <button
          onClick={handleAiImport}
          disabled={busy}
          type="button"
          title={`Import ${filename} using AI parser`}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 500,
            border: 'none',
            borderRadius: 3,
            backgroundColor: '#7c3aed',
            color: '#fff',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {importingAi ? 'AI Processing...' : 'Import (AI)'}
        </button>
      </div>
      {status && (
        <span
          style={{
            fontSize: 11,
            color: status.type === 'error' ? 'var(--theme-error-500)' : 'var(--theme-success-500)',
          }}
        >
          {status.message}
        </span>
      )}
    </div>
  )
}

export default TexImportButton
