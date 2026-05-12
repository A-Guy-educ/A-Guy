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
        className="inline-flex items-center gap-1.5 rounded border border-[var(--theme-elevation-200)] bg-[var(--theme-elevation-0)] px-3 py-1.5 text-[13px] font-medium text-[var(--theme-elevation-1000)] hover:bg-[var(--theme-elevation-50)] cursor-pointer transition-all duration-normal"
        title="Generate AI-powered exercises for this lesson"
      >
        ייצר תרגילים
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[520px] max-w-[90vw] rounded-lg border border-[var(--theme-elevation-200)] bg-[var(--theme-elevation-0)] p-6 text-[var(--theme-elevation-1000)] shadow-modal"
          >
            <h3 className="mt-0 mb-2 text-body-md font-bold">ייצר תרגילים לשיעור</h3>
            <p className="mb-5 text-[13px] leading-relaxed text-[var(--theme-elevation-600)]">
              הזן הוראות ליצירת תרגילים. המערכת תייצר 10 תרגילים חכמים בעברית.
            </p>

            <div className="mb-4">
              <label htmlFor="exercise-prompt" className="mb-1.5 block text-[13px] font-medium">
                פרומפט לתרגילים
              </label>
              <textarea
                id="exercise-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="לדוגמה: צור תרגילים על משוואות קוויות ברמת קושי בינונית, מתאימים לכיתה ז'"
                rows={4}
                className="w-full rounded border border-[var(--theme-elevation-200)] bg-[var(--theme-elevation-0)] p-2.5 text-[13px] text-[var(--theme-elevation-1000)] placeholder:text-[var(--theme-elevation-400)] resize-y font-inherit"
              />
              <p className="mt-1 text-[11px] text-[var(--theme-elevation-600)]">
                מקסימום 2000 תווים
              </p>
            </div>

            <div className="mb-4">
              <span className="mb-2 block text-[13px] font-medium">סוג התרגילים</span>
              <div className="flex flex-col gap-2">
                {EXERCISE_TYPES.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-2 rounded border p-2.5 transition-all duration-fast ${
                      exerciseType === opt.value
                        ? 'border border-[var(--theme-success-500)] bg-[var(--theme-success-500)]/5'
                        : 'border-[var(--theme-elevation-200)] hover:border-[var(--theme-elevation-300)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exercise-type"
                      value={opt.value}
                      checked={exerciseType === opt.value}
                      onChange={() => setExerciseType(opt.value)}
                      className="mt-0.5"
                    />
                    <span className="text-[13px]">
                      <strong className="block">{opt.label}</strong>
                      <span className="mt-0.5 block text-[12px] text-[var(--theme-elevation-600)]">
                        {opt.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {status === 'error' && error && (
              <p className="mb-2 rounded bg-error/10 px-3 py-2 text-[13px] font-medium text-error">
                {error}
              </p>
            )}
            {status === 'success' && (
              <p className="mb-2 rounded bg-success/10 px-3 py-2 text-[13px] font-medium text-success">
                נוצרו {resultCount ?? 10} תרגילים בהצלחה!
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="cursor-pointer rounded border border-[var(--theme-elevation-300)] bg-transparent px-4 py-2 text-[13px] font-medium text-[var(--theme-elevation-800)] hover:bg-[var(--theme-elevation-100)] transition-all duration-normal"
              >
                {status === 'success' ? 'סגור' : 'ביטול'}
              </button>
              {status !== 'success' && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!prompt.trim() || status === 'submitting'}
                  className="cursor-pointer rounded border-none bg-success px-3.5 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 transition-all duration-normal"
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
