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
    label: 'מעורב (מגוון סוגים)',
    hint: 'שילוב של סוגי תרגילים שונים',
  },
  {
    value: 'mcq',
    label: 'בחירה מרובה',
    hint: '4 אפשרויות, אחת נכונה',
  },
  {
    value: 'true_false',
    label: 'נכון / לא נכון',
    hint: 'שני מצבים בלבד',
  },
  {
    value: 'free_response',
    label: 'תשובה חופשית',
    hint: 'התלמיד כותב תשובה משלו',
  },
  {
    value: 'table',
    label: 'טבלה',
    hint: 'השלמת טבלה עם נתונים',
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
      // Auto-close after 3 seconds on success
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
        ייצר תרגילים
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
            <h3 style={{ marginTop: 0 }}>ייצר תרגילים לשיעור</h3>
            <p style={{ fontSize: 13, color: 'var(--theme-elevation-600)' }}>
              הזן הוראות ליצירת תרגילים. המערכת תייצר 10 תרגילים חכמים בעברית.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="exercise-prompt"
                style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}
              >
                פרומפט לתרגילים
              </label>
              <textarea
                id="exercise-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="לדוגמה: צור תרגילים על משוואות קוויות ברמת קושי בינונית, מתאימים לכיתה ז'"
                rows={4}
                style={{
                  width: '100%',
                  padding: 10,
                  fontSize: 13,
                  border: '1px solid var(--theme-elevation-200)',
                  borderRadius: 4,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  color: 'var(--theme-elevation-1000)',
                  backgroundColor: 'var(--theme-elevation-0)',
                }}
              />
              <p style={{ fontSize: 11, color: 'var(--theme-elevation-600)', marginTop: 4 }}>
                מקסימום 2000 תווים
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                סוג התרגילים
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {EXERCISE_TYPES.map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: 10,
                      border:
                        exerciseType === opt.value
                          ? '1px solid var(--theme-success-500)'
                          : '1px solid var(--theme-elevation-200)',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="exercise-type"
                      value={opt.value}
                      checked={exerciseType === opt.value}
                      onChange={() => setExerciseType(opt.value)}
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
            </div>

            {status === 'error' && error && (
              <div style={{ color: 'var(--theme-error-500)', fontSize: 13, marginBottom: 8 }}>
                {error}
              </div>
            )}
            {status === 'success' && (
              <div style={{ color: 'var(--theme-success-500)', fontSize: 13, marginBottom: 8 }}>
                נוצרו {resultCount ?? 10} תרגילים בהצלחה!
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={close}>
                {status === 'success' ? 'סגור' : 'ביטול'}
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
                  {status === 'submitting' ? 'מייצר...' : 'צור תרגילים'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
