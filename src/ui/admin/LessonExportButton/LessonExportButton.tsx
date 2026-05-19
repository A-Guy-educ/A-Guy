'use client'

/**
 * LessonExportButton — admin "Export as JSON" action on the lesson edit view.
 *
 * Fetches /api/lessons/:id/export and triggers a browser file download.
 *
 * @fileType component
 * @domain lessons
 * @pattern admin-action-button
 * @ai-summary Exports a lesson and its exercises as a JSON file for backup or offline review.
 */
import React, { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

export const LessonExportAction: React.FC = () => {
  const { id } = useDocumentInfo()
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!id) return null

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)

    try {
      const res = await fetch(`/api/lessons/${id}/export`, {
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `Export failed (${res.status})`)
        return
      }

      // Extract filename from Content-Disposition header
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="?([^"\n]+)"?/)
      const filename = match?.[1] || `${id}.json`

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          fontSize: 13,
          fontWeight: 500,
          border: '1px solid var(--theme-elevation-200)',
          borderRadius: 4,
          backgroundColor: 'var(--theme-elevation-0)',
          color: 'var(--theme-elevation-1000)',
          cursor: isExporting ? 'not-allowed' : 'pointer',
          opacity: isExporting ? 0.6 : 1,
        }}
        title="Export lesson and exercises as JSON"
      >
        {isExporting ? 'Exporting…' : 'Export as JSON'}
      </button>

      {error && (
        <span
          style={{
            color: 'var(--theme-error-500)',
            fontSize: 12,
            marginLeft: 8,
          }}
        >
          {error}
        </span>
      )}
    </>
  )
}
