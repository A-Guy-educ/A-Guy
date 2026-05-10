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
import { cn } from '@/infra/utils/ui'

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
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5',
          'text-[13px] font-medium font-[var(--theme-elevation-1000)]',
          'border border-[var(--theme-elevation-200)] rounded',
          'bg-[var(--theme-elevation-0)] text-[var(--theme-elevation-1000)]',
          'cursor-pointer transition-all duration-normal',
          'hover:shadow-elevation-1',
        )}
        title="Generate exercises for this lesson using AI"
      >
        Generate Exercises
      </button>

      {open && (
        <>
          {/* Overlay */}
          <div
            role="presentation"
            onClick={close}
            className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center"
          />
          {/* Modal */}
          <div
            role="dialog"
            aria-modal="true"
            className={cn(
              'fixed left-1/2 top-1/2 z-[1001] -translate-x-1/2 -translate-y-1/2',
              'bg-[var(--theme-elevation-0)] border border-[var(--theme-elevation-200)]',
              'rounded-md p-6 w-[520px] max-w-[90vw]',
              'text-[var(--theme-elevation-1000)]',
              'shadow-card',
            )}
          >
            <h3 className="mt-0 mb-2 text-body-lg font-semibold text-[var(--theme-elevation-1000)]">
              Generate Exercises
            </h3>
            <p className="text-[13px] text-[var(--theme-elevation-600)] mb-3 leading-relaxed">
              Describe what kind of exercises you want to generate. The AI will create 10 exercises
              with questions, hints, guiding solutions, and full solutions.
            </p>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="For example: 'Generate 10 exercises about quadratic equations, covering factoring, completing the square, and the quadratic formula. Include varying difficulty levels.'"
              rows={6}
              disabled={status === 'submitting' || status === 'success'}
              className={cn(
                'w-full mt-3 mb-2 p-2 text-[13px]',
                'border border-[var(--theme-elevation-200)] rounded',
                'resize-y font-[inherit] box-border',
                'bg-[var(--theme-elevation-0)] text-[var(--theme-elevation-1000)]',
                'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
                'placeholder:text-[var(--theme-elevation-400)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-fast',
              )}
            />

            {status === 'error' && error && (
              <p className="text-[13px] mb-2 text-error font-medium">{error}</p>
            )}
            {status === 'success' && result && (
              <p className="text-[13px] mb-2 text-success font-medium">
                {result.createdCount ?? 0} exercises created successfully.
                {result.ids && result.ids.length > 0 && (
                  <>
                    {' '}
                    Record IDs: {result.ids.slice(0, 3).join(', ')}
                    {result.ids.length > 3 ? '…' : ''}
                  </>
                )}
              </p>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={close}
                className={cn(
                  'px-3 py-1.5 text-[13px] font-medium rounded',
                  'border border-[var(--theme-elevation-200)]',
                  'bg-[var(--theme-elevation-0)] text-[var(--theme-elevation-800)]',
                  'cursor-pointer transition-all duration-normal',
                  'hover:bg-[var(--theme-elevation-100)]',
                )}
              >
                {status === 'success' ? 'Close' : 'Cancel'}
              </button>
              {status !== 'success' && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={prompt.trim().length < 10 || status === 'submitting'}
                  className={cn(
                    'px-3 py-1.5 text-[13px] font-medium rounded',
                    'bg-success text-white border-none',
                    'transition-all duration-normal',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    'hover:opacity-90 hover:shadow-elevation-1',
                  )}
                >
                  {status === 'submitting' ? 'Generating…' : 'Generate 10 Exercises'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
