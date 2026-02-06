/**
 * PDF File Selector Component
 *
 * @fileType component
 * @domain admin
 * @pattern file-selector
 * @ai-summary Dropdown to select a PDF file from a lesson's content files
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { labelStyle } from '../styles'

interface PdfFile {
  id: string
  filename: string
  mimeType: string
}

interface PdfSelectorProps {
  lessonId: string
  selectedMediaId: string | null
  onSelectMedia: (mediaId: string) => void
}

const loadingStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-500)',
  marginTop: 4,
}

const errorStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-error)',
}

const emptyStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-500)',
  marginTop: 4,
}

const fieldGroupStyle: React.CSSProperties = {
  marginTop: 8,
}

const radioGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const radioLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: 13,
  color: 'var(--theme-elevation-1000)',
}

const radioLabelSelectedStyle: React.CSSProperties = {
  ...radioLabelStyle,
  backgroundColor: 'var(--theme-elevation-100)',
  border: '1px solid var(--theme-elevation-400)',
}

const radioLabelUnselectedStyle: React.CSSProperties = {
  ...radioLabelStyle,
  border: '1px solid transparent',
}

export function PdfSelector({ lessonId, selectedMediaId, onSelectMedia }: PdfSelectorProps) {
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!lessonId) {
      setPdfFiles([])
      return
    }

    async function fetchLessonFiles() {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/lessons/${lessonId}?depth=1`)
        if (!response.ok) {
          throw new Error('Failed to fetch lesson')
        }
        const data = await response.json()
        const contentFiles = data.contentFiles || []

        // Handle both shapes: flat media objects and nested media objects
        const pdfs: PdfFile[] = contentFiles
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((file: any) => {
            const mime = file.mimeType || file.media?.mimeType
            return mime === 'application/pdf'
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((file: any) => ({
            id: file.id || file.media?.id,
            filename: file.filename || file.media?.filename || 'Unknown',
            mimeType: file.mimeType || file.media?.mimeType || 'application/pdf',
          }))
        setPdfFiles(pdfs)
      } catch (err) {
        console.error('Failed to fetch lesson files:', err)
        setError('Failed to load PDF files')
        setPdfFiles([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchLessonFiles()
  }, [lessonId])

  const handleSelect = useCallback(
    (mediaId: string) => {
      onSelectMedia(mediaId)
    },
    [onSelectMedia],
  )

  if (isLoading) {
    return (
      <fieldset style={fieldGroupStyle}>
        <legend style={labelStyle}>Select PDF</legend>
        <div style={loadingStyle}>Loading PDF files...</div>
      </fieldset>
    )
  }

  if (error) {
    return (
      <fieldset style={fieldGroupStyle}>
        <legend style={labelStyle}>Select PDF</legend>
        <div style={errorStyle}>{error}</div>
      </fieldset>
    )
  }

  if (pdfFiles.length === 0) {
    return (
      <fieldset style={fieldGroupStyle}>
        <legend style={labelStyle}>Select PDF</legend>
        <div style={emptyStyle}>No PDFs attached to this lesson</div>
      </fieldset>
    )
  }

  return (
    <fieldset style={fieldGroupStyle}>
      <legend style={labelStyle}>Select PDF</legend>
      <div style={radioGroupStyle}>
        {pdfFiles.map((pdf) => (
          <label
            key={pdf.id}
            style={selectedMediaId === pdf.id ? radioLabelSelectedStyle : radioLabelUnselectedStyle}
          >
            <input
              type="radio"
              name="pdf-selection"
              value={pdf.id}
              checked={selectedMediaId === pdf.id}
              onChange={() => handleSelect(pdf.id)}
              style={{ marginRight: 8 }}
            />
            <span style={{ fontSize: 13 }}>{pdf.filename}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
