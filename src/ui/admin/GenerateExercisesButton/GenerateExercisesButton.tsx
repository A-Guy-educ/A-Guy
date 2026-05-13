'use client'

/**
 * GenerateExercisesButton — admin "Generate Exercises" action on the lesson edit view.
 *
 * @fileType component
 * @domain lessons
 * @pattern admin-action-modal
 * @ai-summary Opens a modal to enter a custom prompt, then POSTs to /api/lessons/:id/generate-exercises.
 */
import React, { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

const EXERCISE_TYPES: {
  value: 'mcq' | 'true_false' | 'free_response' | 'table' | 'mixed'
  label: string
  hint: string
}[] = [
  {
    value: 'mixed',
    label: 'Mixed (variety of types)',
    hint: 'Combination of different exercise types',
  },
  {
    value: 'mcq',
    label: 'Multiple choice',
    hint: '4 options, one correct',
  },
  {
    value: 'true_false',
    label: 'True / False',
    hint: 'Two options only',
  },
  {
    value: 'free_response',
    label: 'Free response',
    hint: 'Student writes their own answer',
  },
  {
    value: 'table',
    label: 'Table',
    hint: 'Fill in a table with data',
  },
]

type Status = 'idle' | 'submitting' | 'success' | 'error'

export const GenerateExercisesAction: React.FC = () => {
  const { id } = useDocumentInfo()
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [exerciseType, setExerciseType] =
    useState<(typeof EXERCISE_TYPES)[number]['value']>('mixed')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [resultCount, setResultCount] = useState<number | null>(null)

  if (!id) return null

  const reset = () => {
    setPrompt('')
    setExerciseType('mixed')
    setStatus('idle')
    setError(null)
    setResultCount(null)
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  const submit = async () => {
    if (!prompt.trim()) return
    setStatus('submitting')
    setError(null)
    try {
      const res = await fetch(`/api/lessons/${id}/generate-exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt, exerciseType }),
      })
      const data = (await res.json()) as {
        count?: number
        error?: string
      }
      if (!res.ok) {
        setStatus('error')
        setError(data.error ?? `Request failed (${res.status})`)
        return
      }
      setStatus('success')
      setResultCount(data.count ?? null)
      setTimeout(() => {
        close()
      }, 3000)
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
        title="Generate AI-powered exercises for this lesson"
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
            <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>
              Generate Exercises for Lesson
            </h3>
            <p style={{ fontSize: 13, color: 'var(--theme-elevation-600)', marginBottom: 20 }}>
              Enter instructions for generating exercises. The system will create 10 smart exercises
              in Hebrew.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="exercise-prompt"
                style={{
                  display: 'block',
                  marginBottom: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--theme-elevation-800)',
                }}
              >
                Exercise Prompt
              </label>
              <textarea
                id="exercise-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="For example: Create exercises about linear equations at medium difficulty, suitable for grade 7"
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 13,
                  border: '1px solid var(--theme-elevation-200)',
                  borderRadius: 4,
                  backgroundColor: 'var(--theme-elevation-0)',
                  color: 'var(--theme-elevation-1000)',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
              <p style={{ marginTop: 4, fontSize: 11, color: 'var(--theme-elevation-600)' }}>
                Maximum 2000 characters
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <span
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--theme-elevation-800)',
                }}
              >
                Exercise Type
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {EXERCISE_TYPES.map((opt) => {
                  const isSelected = exerciseType === opt.value
                  return (
                    <label
                      key={opt.value}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: 10,
                        border: isSelected
                          ? '1px solid var(--theme-success-500)'
                          : '1px solid var(--theme-elevation-200)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        backgroundColor: isSelected
                          ? 'rgba(0, 168, 116, 0.05)'
                          : 'var(--theme-elevation-0)',
                      }}
                    >
                      <input
                        type="radio"
                        name="exercise-type"
                        value={opt.value}
                        checked={exerciseType === opt.value}
                        onChange={() => setExerciseType(opt.value)}
                        style={{ marginTop: 2 }}
                      />
                      <span style={{ fontSize: 13 }}>
                        <strong style={{ display: 'block' }}>{opt.label}</strong>
                        <span
                          style={{
                            display: 'block',
                            marginTop: 2,
                            fontSize: 12,
                            color: 'var(--theme-elevation-600)',
                          }}
                        >
                          {opt.hint}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {status === 'error' && error && (
              <div
                style={{
                  marginBottom: 8,
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--theme-error-500)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 4,
                }}
              >
                {error}
              </div>
            )}
            {status === 'success' && (
              <div
                style={{
                  marginBottom: 8,
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--theme-success-500)',
                  backgroundColor: 'rgba(0, 168, 116, 0.1)',
                  borderRadius: 4,
                }}
              >
                {resultCount ?? 10} exercises created successfully!
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={close}
                style={{
                  padding: '6px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid var(--theme-elevation-300)',
                  borderRadius: 4,
                  backgroundColor: 'transparent',
                  color: 'var(--theme-elevation-800)',
                  cursor: 'pointer',
                }}
              >
                {status === 'success' ? 'Close' : 'Cancel'}
              </button>
              {status !== 'success' && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!prompt.trim() || status === 'submitting'}
                  style={{
                    padding: '6px 14px',
                    fontSize: 13,
                    fontWeight: 500,
                    border: 'none',
                    borderRadius: 4,
                    backgroundColor: 'var(--theme-success-500)',
                    color: '#fff',
                    cursor: !prompt.trim() || status === 'submitting' ? 'not-allowed' : 'pointer',
                    opacity: !prompt.trim() || status === 'submitting' ? 0.6 : 1,
                  }}
                >
                  {status === 'submitting' ? 'Generating…' : 'Generate Exercises'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
