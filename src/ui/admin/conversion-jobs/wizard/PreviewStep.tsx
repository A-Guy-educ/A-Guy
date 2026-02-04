/**
 * PDF Preview Step
 *
 * Second step - preview PDF and configure page range
 *
 * @fileType component
 * @domain admin
 * @pattern wizard-step
 * @ai-summary Second wizard step for PDF preview and page selection
 */

'use client'

import { useEffect, useState } from 'react'

interface MediaFile {
  id: string
  filename: string
  url?: string
  filesize?: number
  width?: number
  height?: number
}

interface PreviewStepProps {
  mediaId: string
  pageRange: { start: number; end?: number; excludePages: number[] }
  onChange: (data: { pageRange: { start: number; end?: number; excludePages: number[] } }) => void
  onValidationChange: (isValid: boolean) => void
}

export function PreviewStep({
  mediaId,
  pageRange,
  onChange,
  onValidationChange,
}: PreviewStepProps) {
  const [media, setMedia] = useState<MediaFile | null>(null)
  const [totalPages, setTotalPages] = useState<number>(0)
  const [localRange, setLocalRange] = useState(pageRange)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchMedia() {
      if (!mediaId) {
        setIsLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/media/${mediaId}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setMedia(data)

          // For PDF, we might need to get page count from a preview endpoint
          // For now, estimate or fetch from preview
          if (data.mimeType === 'application/pdf') {
            // Try to get page count from preview
            const previewRes = await fetch(`/api/conversion-jobs/preview?mediaId=${mediaId}`, {
              credentials: 'include',
            })
            if (previewRes.ok) {
              const previewData = await previewRes.json()
              setTotalPages(previewData.totalPages || 0)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch media:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchMedia()
  }, [mediaId])

  useEffect(() => {
    const isValid =
      localRange.start > 0 &&
      (localRange.end === undefined || localRange.end >= localRange.start) &&
      localRange.start <= totalPages
    onValidationChange(isValid)
  }, [localRange, totalPages, onValidationChange])

  const handleStartChange = (value: number) => {
    const newRange = { ...localRange, start: value }
    setLocalRange(newRange)
    onChange({ pageRange: newRange })
  }

  const handleEndChange = (value: number | undefined) => {
    const newRange = { ...localRange, end: value }
    setLocalRange(newRange)
    onChange({ pageRange: newRange })
  }

  if (!mediaId) {
    return (
      <div className="wizard-step preview-step">
        <p className="empty-state">Please select a source in the previous step.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="wizard-step preview-step">
        <div className="step-loading">Loading preview...</div>
      </div>
    )
  }

  return (
    <div className="wizard-step preview-step">
      <h2>Configure Page Range</h2>
      <p className="step-description">Select which pages to include in the conversion</p>

      <div className="preview-info">
        <span className="file-name">{media?.filename}</span>
        {totalPages > 0 && <span className="page-count">{totalPages} pages total</span>}
      </div>

      {media?.url && (
        <div className="pdf-preview">
          <iframe src={`${media.url}#toolbar=0&navpanes=0`} title="PDF Preview" />
        </div>
      )}

      <div className="page-range-config">
        <div className="range-inputs">
          <div className="form-group">
            <label htmlFor="startPage">Start Page</label>
            <input
              id="startPage"
              type="number"
              min={1}
              max={totalPages || 999}
              value={localRange.start}
              onChange={(e) => handleStartChange(parseInt(e.target.value) || 1)}
              className="form-input"
            />
          </div>

          <span className="range-separator">to</span>

          <div className="form-group">
            <label htmlFor="endPage">End Page (optional)</label>
            <input
              id="endPage"
              type="number"
              min={1}
              max={totalPages || 999}
              placeholder="End"
              value={localRange.end || ''}
              onChange={(e) =>
                handleEndChange(e.target.value ? parseInt(e.target.value) : undefined)
              }
              className="form-input"
            />
          </div>
        </div>

        <p className="range-hint">
          {localRange.end
            ? `Selected: ${localRange.start} - ${localRange.end} (${localRange.end - localRange.start + 1} pages)`
            : `Selected: Page ${localRange.start} onwards (${totalPages - localRange.start + 1} pages)`}
        </p>
      </div>

      <style>{`
        .preview-step { padding: 1rem; }
        .step-description { color: var(--theme-elevation-500); margin-bottom: 1rem; }
        .preview-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: var(--theme-elevation-50);
          border-radius: 4px;
        }
        .file-name { font-weight: 500; }
        .page-count { color: var(--theme-elevation-500); font-size: 0.875rem; }
        .pdf-preview {
          width: 100%;
          height: 300px;
          border: 1px solid var(--theme-elevation-200);
          border-radius: 4px;
          margin-bottom: 1rem;
          overflow: hidden;
        }
        .pdf-preview iframe { width: 100%; height: 100%; border: none; }
        .range-inputs { display: flex; align-items: flex-end; gap: 0.5rem; }
        .range-separator { padding-bottom: 0.5rem; color: var(--theme-elevation-500); }
        .form-group { margin-bottom: 0; }
        .form-group label { display: block; font-size: 0.875rem; margin-bottom: 0.25rem; }
        .form-input { width: 80px; padding: 0.5rem; border: 1px solid var(--theme-elevation-200); border-radius: 4px; }
        .range-hint { font-size: 0.875rem; color: var(--theme-elevation-500); margin-top: 0.5rem; }
        .empty-state { text-align: center; color: var(--theme-elevation-500); padding: 2rem; }
        .step-loading { text-align: center; padding: 2rem; color: var(--theme-elevation-500); }
      `}</style>
    </div>
  )
}
