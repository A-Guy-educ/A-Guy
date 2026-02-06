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
        const pdfs: PdfFile[] = contentFiles
          .filter(
            (file: { media?: { mimeType: string } }) => file.media?.mimeType === 'application/pdf',
          )
          .map((file: { media: { id: string; filename: string; mimeType: string } }) => ({
            id: file.media.id,
            filename: file.media.filename,
            mimeType: file.media.mimeType,
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
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Select PDF</label>
        <div className="text-sm text-gray-500">Loading PDF files...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Select PDF</label>
        <div className="text-sm text-red-600">{error}</div>
      </div>
    )
  }

  if (pdfFiles.length === 0) {
    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Select PDF</label>
        <div className="text-sm text-gray-500">No PDFs attached to this lesson</div>
      </div>
    )
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-700">Select PDF</legend>
      <div className="space-y-1">
        {pdfFiles.map((pdf) => (
          <label
            key={pdf.id}
            className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
              selectedMediaId === pdf.id
                ? 'bg-blue-50 border border-blue-200'
                : 'hover:bg-gray-50 border border-transparent'
            }`}
          >
            <input
              type="radio"
              name="pdf-selection"
              value={pdf.id}
              checked={selectedMediaId === pdf.id}
              onChange={() => handleSelect(pdf.id)}
              className="text-blue-600"
            />
            <span className="text-sm text-gray-900">{pdf.filename}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
