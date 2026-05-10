'use client'

/**
 * LessonGenerateExercisesButton — admin "Generate exercises" action on the lesson edit view.
 *
 * @fileType component
 * @domain lessons
 * @pattern admin-action-modal
 * @ai-summary Opens a modal to enter a dynamic prompt, then POSTs to /api/lessons/:id/generate-exercises.
 */
import React, { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

type Status = 'idle' | 'submitting' | 'success' | 'error'

export const LessonGenerateExercisesAction: React.FC = () => {
  const { id } = useDocumentInfo()
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ createdCount?: number; ids?: string[] } | null>(null)

  if (!id) return null

  const close = () => {
    setOpen(false)
    setPrompt('')
    setStatus('idle')
    setError(null)
    setResult(null)
  }

  const submit = async () => {
    if (!prompt.trim() || prompt.trim().length < 10) return
    setStatus('submitting')
    setError(null)
    try {
      const res = await fetch(`/api/lessons/${id}/generate-exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      const data = (await res.json()) as {
        success?: boolean
        error?: string
        data?: { createdExerciseIds?: string[]; totalCreated?: number }
      }
      if (!res.ok || !data.success) {
        setStatus('error')
        setError(data.error ?? `Request failed (${res.status})`)
        return
      }
      setStatus('success')
      setResult({
        createdCount: data.data?.totalCreated,
        ids: data.data?.createdExerciseIds,
      })
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Network error')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
          cursor: 'pointer',
        }}
        title="Generate exercises for this lesson using AI"
      >
        Generate Exercises
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--theme-elevation-0)',
              border: '1px solid var(--theme-elevation-200)',
              borderRadius: 6,
              padding: 24,
              width: 520,
              maxWidth: '90vw',
              color: 'var(--theme-elevation-1000)',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Generate Exercises</h3>
            <p style={{ fontSize: 13, color: 'var(--theme-elevation-600)' }}>
              Describe what kind of exercises you want to generate. The AI will create 10 exercises
              with questions, hints, guiding solutions, and full solutions.
            </p>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="For example: 'Generate 10 exercises about quadratic equations, covering factoring, completing the square, and the quadratic formula. Include varying difficulty levels.'"
              rows={6}
              style={{
                width: '100%',
                marginTop: 12,
                marginBottom: 8,
                padding: 8,
                fontSize: 13,
                border: '1px solid var(--theme-elevation-200)',
                borderRadius: 4,
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              disabled={status === 'submitting' || status === 'success'}
            />

            {status === 'error' && error && (
              <div
                style={{
                  color: 'var(--theme-error-500)',
                  fontSize: 13,
                  marginBottom: 8,
                }}
              >
                {error}
              </div>
            )}
            {status === 'success' && result && (
              <div
                style={{
                  color: 'var(--theme-success-500)',
                  fontSize: 13,
                  marginBottom: 8,
                }}
              >
                {result.createdCount ?? 0} exercises created successfully.
                {result.ids && result.ids.length > 0 && (
                  <>
                    {' '}
                    Record IDs: {result.ids.slice(0, 3).join(', ')}
                    {result.ids.length > 3 ? '…' : ''}
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={close}>
                {status === 'success' ? 'Close' : 'Cancel'}
              </button>
              {status !== 'success' && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={prompt.trim().length < 10 || status === 'submitting'}
                  style={{
                    backgroundColor: 'var(--theme-success-500)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 14px',
                    cursor:
                      prompt.trim().length < 10 || status === 'submitting'
                        ? 'not-allowed'
                        : 'pointer',
                    opacity: prompt.trim().length < 10 || status === 'submitting' ? 0.6 : 1,
                  }}
                >
                  {status === 'submitting' ? 'Generating…' : 'Generate 10 Exercises'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
