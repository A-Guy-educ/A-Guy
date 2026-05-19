'use client'

/**
 * GenerateExercisesButton — admin "Generate Exercises" action on the lesson edit view.
 *
 * @fileType component
 * @domain lessons
 * @pattern admin-action-modal
 * @ai-summary Opens a modal to enter a prompt, then POSTs to /api/lessons/:id/generate-exercises with two-phase generation.
 */
import React, { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

type Status = 'idle' | 'submitting' | 'success' | 'error' | 'partial'

interface ExerciseResult {
  exerciseId: string
  status: 'pending' | 'generated' | 'failed'
  error?: string
}

interface GenerationResponse {
  success: boolean
  lessonId: string
  requestedCount: number
  createdCount: number
  generatedCount: number
  exerciseIds: string[]
  results: ExerciseResult[]
  error?: string
}

const DEFAULT_COUNT = 10

export const GenerateExercisesAction: React.FC = () => {
  const { id } = useDocumentInfo()
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [count] = useState(DEFAULT_COUNT)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [generatedCount, setGeneratedCount] = useState(0)
  const [requestedCount, setRequestedCount] = useState(0)

  if (!id) return null

  const reset = () => {
    setPrompt('')
    setStatus('idle')
    setError(null)
    setGeneratedCount(0)
    setRequestedCount(0)
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  const submit = async () => {
    if (!prompt.trim()) return
    setStatus('submitting')
    setError(null)
    setRequestedCount(count)

    try {
      const res = await fetch(`/api/lessons/${id}/generate-exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt: prompt.trim(), count }),
      })

      const data = (await res.json()) as GenerationResponse

      if (!res.ok) {
        setStatus('error')
        setError(data.error ?? `Request failed (${res.status})`)
        return
      }

      setGeneratedCount(data.generatedCount)
      setRequestedCount(data.requestedCount)

      if (data.generatedCount === data.requestedCount) {
        setStatus('success')
      } else {
        setStatus('partial')
      }

      setTimeout(() => close(), 2000)
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
        title="Generate AI exercises for this lesson"
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
              maxHeight: '85vh',
              overflowY: 'auto',
              color: 'var(--theme-elevation-1000)',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Generate Exercises</h3>
            <p style={{ fontSize: 13, color: 'var(--theme-elevation-600)' }}>
              Enter a prompt describing what kind of exercises you want. The AI will generate{' '}
              {count} exercises with hints, solutions, and full solutions.
            </p>

            {status === 'idle' || status === 'error' ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label
                    htmlFor="exercise-prompt"
                    style={{ display: 'block', fontSize: 13, marginBottom: 6 }}
                  >
                    Prompt (Hebrew)
                  </label>
                  <textarea
                    id="exercise-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., תרגילים על משוואות עם נעלם אחד, רמה בסיסית"
                    rows={5}
                    style={{
                      width: '100%',
                      padding: 8,
                      fontSize: 13,
                      border: '1px solid var(--theme-elevation-200)',
                      borderRadius: 4,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      backgroundColor: 'var(--theme-elevation-0)',
                      color: 'var(--theme-elevation-1000)',
                    }}
                  />
                </div>

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

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={close}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!prompt.trim()}
                    style={{
                      backgroundColor: 'var(--theme-success-500)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '6px 14px',
                      cursor: !prompt.trim() ? 'not-allowed' : 'pointer',
                      opacity: !prompt.trim() ? 0.6 : 1,
                    }}
                  >
                    Generate {count} Exercises
                  </button>
                </div>
              </>
            ) : status === 'submitting' ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    padding: '24px 0',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      border: '3px solid var(--theme-elevation-200)',
                      borderTopColor: 'var(--theme-success-500)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <p style={{ fontSize: 13, color: 'var(--theme-elevation-600)' }}>
                    Generating exercises... (this may take a few minutes)
                  </p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              </>
            ) : status === 'success' ? (
              <>
                <div
                  style={{
                    color: 'var(--theme-success-500)',
                    fontSize: 14,
                    marginBottom: 16,
                    fontWeight: 500,
                  }}
                >
                  Created {generatedCount} exercises — preparing content...
                </div>
                <p style={{ fontSize: 13, color: 'var(--theme-elevation-600)', marginBottom: 16 }}>
                  The exercises have been added to this lesson. Content will be generated shortly.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={close}>
                    Close
                  </button>
                </div>
              </>
            ) : status === 'partial' ? (
              <>
                <div
                  style={{
                    color: 'var(--theme-warning-500)',
                    fontSize: 14,
                    marginBottom: 16,
                    fontWeight: 500,
                  }}
                >
                  Created {generatedCount} of {requestedCount} exercises — preparing remaining
                  content...
                </div>
                <p style={{ fontSize: 13, color: 'var(--theme-elevation-600)', marginBottom: 16 }}>
                  Content generation is still in progress. The exercises that were successfully
                  created will be ready shortly.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={close}>
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      reset()
                      setStatus('idle')
                    }}
                    style={{
                      backgroundColor: 'var(--theme-elevation-200)',
                      color: 'var(--theme-elevation-1000)',
                      border: 'none',
                      borderRadius: 4,
                      padding: '6px 14px',
                      cursor: 'pointer',
                    }}
                  >
                    Try Again
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
