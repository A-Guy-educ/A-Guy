'use client'

/**
 * LessonDuplicateButton — admin "Duplicate" action on the lesson edit view.
 *
 * @fileType component
 * @domain lessons
 * @pattern admin-action-modal
 * @ai-summary Opens a modal to pick a variation level, then POSTs to /api/lessons/:id/duplicate.
 */
import React, { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

const LEVELS: { value: 'none' | 'light' | 'medium' | 'deep'; label: string; hint: string }[] = [
  { value: 'none', label: 'None — exact copy', hint: 'Clones the lesson and exercises as-is.' },
  {
    value: 'light',
    label: 'Light — change numbers',
    hint: 'Same wording, different numeric values.',
  },
  {
    value: 'medium',
    label: 'Medium — numbers + phrasing',
    hint: 'Reworded question, same difficulty.',
  },
  {
    value: 'deep',
    label: 'Deep — values, functions, sections',
    hint: 'Larger structural variation.',
  },
]

type Status = 'idle' | 'submitting' | 'success' | 'error'

export const LessonDuplicateAction: React.FC = () => {
  const { id } = useDocumentInfo()
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<(typeof LEVELS)[number]['value'] | ''>('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [resultId, setResultId] = useState<string | null>(null)

  if (!id) return null

  const reset = () => {
    setLevel('')
    setStatus('idle')
    setError(null)
    setResultId(null)
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  const submit = async () => {
    if (!level) return
    setStatus('submitting')
    setError(null)
    try {
      const res = await fetch(`/api/lessons/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ level }),
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
        title="Duplicate lesson with optional AI variation"
      >
        Duplicate
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
              width: 480,
              maxWidth: '90vw',
              color: 'var(--theme-elevation-1000)',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Duplicate lesson</h3>
            <p style={{ fontSize: 13, color: 'var(--theme-elevation-600)' }}>
              Pick how different the copy should be.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0' }}>
              {LEVELS.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: 10,
                    border:
                      level === opt.value
                        ? '1px solid var(--theme-success-500)'
                        : '1px solid var(--theme-elevation-200)',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="dup-level"
                    value={opt.value}
                    checked={level === opt.value}
                    onChange={() => setLevel(opt.value)}
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

            {status === 'error' && error && (
              <div style={{ color: 'var(--theme-error-500)', fontSize: 13, marginBottom: 8 }}>
                {error}
              </div>
            )}
            {status === 'success' && (
              <div style={{ color: 'var(--theme-success-500)', fontSize: 13, marginBottom: 8 }}>
                Duplication created (record id: {resultId ?? 'unknown'}).
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
                  disabled={!level || status === 'submitting'}
                  style={{
                    backgroundColor: 'var(--theme-success-500)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 14px',
                    cursor: !level || status === 'submitting' ? 'not-allowed' : 'pointer',
                    opacity: !level || status === 'submitting' ? 0.6 : 1,
                  }}
                >
                  {status === 'submitting' ? 'Duplicating…' : 'Duplicate'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
