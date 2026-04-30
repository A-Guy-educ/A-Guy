'use client'

import { useEffect, useState } from 'react'

interface PromptOption {
  id: string
  title: string
}

interface FullConvertMediaButtonProps {
  lessonId: string
  mediaId: string
  filename: string
}

/**
 * One-click "Full Convert (Media)" button. Opens a small modal so the
 * admin can pick which context_extractor prompt drives Stage 1, then
 * runs the full pipeline (Stage 1 → 2 → 3) on the server in one call.
 */
export function FullConvertMediaButton({
  lessonId,
  mediaId,
  filename,
}: FullConvertMediaButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [prompts, setPrompts] = useState<PromptOption[]>([])
  const [selectedPromptId, setSelectedPromptId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    if (!isOpen) return
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setWarnings([])
    fetch('/api/prompts/for-conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId }),
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => setPrompts(data.contextExtractors || []))
      .catch(() => setError('Failed to load prompts'))
      .finally(() => setIsLoading(false))
  }, [isOpen, lessonId])

  useEffect(() => {
    if (!isOpen) {
      setSelectedPromptId('')
      setError(null)
      setSuccess(null)
      setWarnings([])
    }
  }, [isOpen])

  async function handleRun() {
    if (!selectedPromptId) {
      setError('Please select a prompt')
      return
    }
    setIsRunning(true)
    setError(null)
    setSuccess(null)
    setWarnings([])
    try {
      const response = await fetch('/api/lessons/convert-full-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, mediaId, promptId: selectedPromptId }),
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
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: '4px 12px',
          fontSize: 11,
          fontWeight: 500,
          border: 'none',
          borderRadius: 3,
          backgroundColor: 'var(--theme-success)',
          color: 'var(--theme-elevation-0)',
          cursor: 'pointer',
        }}
      >
        Full Convert (Media)
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isRunning) setIsOpen(false)
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--theme-elevation-0)',
              borderRadius: 8,
              padding: 20,
              width: '90%',
              maxWidth: 450,
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 4,
                color: 'var(--theme-elevation-1000)',
              }}
            >
              Full Convert (Media)
            </h3>
            <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)', marginBottom: 16 }}>
              Run extraction → create exercises → convert LaTeX blocks for {filename} in one shot.
            </p>

            {isLoading && (
              <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)', padding: 20 }}>
                Loading prompts...
              </div>
            )}

            {!isLoading && prompts.length === 0 && !error && (
              <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)', padding: 20 }}>
                No context extractor prompts available for this lesson.
              </div>
            )}

            {!isLoading && prompts.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 6,
                    color: 'var(--theme-elevation-700)',
                  }}
                >
                  Extractor prompt
                </label>
                <select
                  value={selectedPromptId}
                  onChange={(e) => setSelectedPromptId(e.target.value)}
                  disabled={isRunning}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 13,
                    border: '1px solid var(--theme-elevation-200)',
                    borderRadius: 4,
                    backgroundColor: 'var(--theme-elevation-0)',
                    color: 'var(--theme-elevation-1000)',
                  }}
                >
                  <option value="">-- Select a prompt --</option>
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--theme-error)',
                  padding: '8px 12px',
                  backgroundColor: 'var(--theme-error-100)',
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            {success && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--theme-success)',
                  padding: '8px 12px',
                  backgroundColor: 'var(--theme-success-100)',
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                {success}
              </div>
            )}

            {warnings.length > 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--theme-elevation-800)',
                  padding: '8px 12px',
                  backgroundColor: 'var(--theme-elevation-100)',
                  borderRadius: 4,
                  borderLeft: '3px solid orange',
                  marginBottom: 16,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {warnings.map((w, i) => (
                  <div key={i} style={{ marginBottom: i < warnings.length - 1 ? 4 : 0 }}>
                    {w}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsOpen(false)}
                disabled={isRunning}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid var(--theme-elevation-200)',
                  borderRadius: 4,
                  backgroundColor: 'var(--theme-elevation-0)',
                  color: 'var(--theme-elevation-700)',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                }}
              >
                Close
              </button>
              <button
                onClick={handleRun}
                disabled={isRunning || isLoading || prompts.length === 0 || !!success}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid var(--theme-elevation-200)',
                  borderRadius: 4,
                  backgroundColor: success
                    ? 'var(--theme-success)'
                    : isRunning
                      ? 'var(--theme-elevation-400)'
                      : 'var(--theme-elevation-1000)',
                  color: 'var(--theme-elevation-0)',
                  cursor: isRunning || success ? 'not-allowed' : 'pointer',
                  opacity: isRunning ? 0.6 : 1,
                }}
              >
                {isRunning ? 'Running full pipeline...' : success ? 'Done' : 'Run Full Convert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default FullConvertMediaButton
