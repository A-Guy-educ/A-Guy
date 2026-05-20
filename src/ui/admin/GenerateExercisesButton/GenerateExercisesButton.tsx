'use client'

/**
 * GenerateExercisesButton — admin "Generate Exercises" action on the lesson edit view.
 *
 * @fileType component
 * @domain lessons
 * @pattern admin-action-modal
 * @ai-summary Opens a modal to enter a prompt and generate exercises via AI.
 */
import React, { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

const DIFFICULTIES: { value: 'easy' | 'medium' | 'hard'; label: string; hint: string }[] = [
  {
    value: 'easy',
    label: 'Easy',
    hint: 'Simple concepts, straightforward calculations.',
  },
  {
    value: 'medium',
    label: 'Medium',
    hint: 'Moderate complexity, multi-step problems.',
  },
  {
    value: 'hard',
    label: 'Hard',
    hint: 'Advanced concepts, challenging structures.',
  },
]

const EXERCISE_COUNTS = [
  { value: 3, label: '3 exercises' },
  { value: 5, label: '5 exercises' },
  { value: 10, label: '10 exercises' },
]

type Status = 'idle' | 'submitting' | 'success' | 'error'

export const GenerateExercisesButton: React.FC = () => {
  const { id } = useDocumentInfo()
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [maxCount, setMaxCount] = useState(10)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [resultId, setResultId] = useState<string | null>(null)

  if (!id) return null

  const reset = () => {
    setPrompt('')
    setMaxCount(10)
    setDifficulty('medium')
    setStatus('idle')
    setError(null)
    setResultId(null)
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
        body: JSON.stringify({ prompt: prompt.trim(), maxCount, difficultyLevel: difficulty }),
      })
      const data = (await res.json()) as { id?: string; error?: string }
      if (!res.ok) {
        setStatus('error')
        setError(data.error ?? `Request failed (${res.status})`)
        return
      }
      setStatus('success')
      setResultId(data.id ?? null)
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
        title="Generate new exercises using AI"
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
              Enter a prompt to generate new exercises for this lesson.
            </p>

            {/* Number of exercises */}
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Number of exercises</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {EXERCISE_COUNTS.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 12px',
                    border:
                      maxCount === opt.value
                        ? '1px solid var(--theme-success-500)'
                        : '1px solid var(--theme-elevation-200)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <input
                    type="radio"
                    name="exercise-count"
                    value={opt.value}
                    checked={maxCount === opt.value}
                    onChange={() => setMaxCount(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {/* Difficulty */}
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Difficulty level</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {DIFFICULTIES.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: 10,
                    border:
                      difficulty === opt.value
                        ? '1px solid var(--theme-success-500)'
                        : '1px solid var(--theme-elevation-200)',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="difficulty"
                    value={opt.value}
                    checked={difficulty === opt.value}
                    onChange={() => setDifficulty(opt.value)}
                  />
                  <span>
                    <strong>{opt.label}</strong>
                    <br />
                    <span style={{ fontSize: 12, color: 'var(--theme-elevation-600)' }}>
                      {opt.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            {/* Prompt */}
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
              Exercise prompt <span style={{ color: 'var(--theme-error-500)' }}>*</span>
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Generate exercises about quadratic equations, including factoring and quadratic formula problems"
              rows={4}
              style={{
                width: '100%',
                padding: 10,
                border: '1px solid var(--theme-elevation-200)',
                borderRadius: 4,
                fontSize: 13,
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
                marginBottom: 16,
              }}
            />

            {status === 'error' && error && (
              <div style={{ color: 'var(--theme-error-500)', fontSize: 13, marginBottom: 8 }}>
                {error}
              </div>
            )}
            {status === 'success' && (
              <div style={{ color: 'var(--theme-success-500)', fontSize: 13, marginBottom: 8 }}>
                Generation started (record id: {resultId ?? 'unknown'}). Exercises will be created
                in the background.
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
                  disabled={!prompt.trim() || status === 'submitting'}
                  style={{
                    backgroundColor: 'var(--theme-success-500)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 14px',
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
