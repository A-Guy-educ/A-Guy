/**
 * Lesson Duplication Review Component
 *
 * @fileType component
 * @domain admin
 * @pattern review-list
 * @ai-summary Admin review UI for lesson duplication failures. Lets admin skip, regenerate, or keep each failed exercise.
 */
// smoke-test: prOutcome + flake-retry exercise (v0.4.38)
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { DiffPreview } from './DiffPreview'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

type Action = 'skip' | 'regenerate' | 'keep' | 'looks_right'
type RegenLevel = 'light' | 'medium' | 'deep'

interface FailureEntry {
  exerciseRef: string
  sectionIndex: number
  code: string
  message: string
  suggestedAction: string
  resolved: boolean
}

interface OutputExerciseEntry {
  sourceExerciseId: string
  outputExerciseId: string
  strategy: string
}

interface ExercisePairData {
  sourceExerciseId: string
  outputExerciseId: string
  strategy: string
  sourceContent: { blocks: ContentBlock[] }
  outputContent: { blocks: ContentBlock[] }
}

interface DuplicationRecord {
  id: string
  level: string
  status: string
  sourceLesson: { id: string; title?: string } | string
  outputLesson: { id: string } | string | null
  outputExercises: OutputExerciseEntry[]
  failures: FailureEntry[]
  exercisePairs?: ExercisePairData[]
}

// --- Styles (inline CSS-in-JS, matching Payload theme) ---
const pageStyle: React.CSSProperties = { padding: '24px', maxWidth: 960 }
const headerStyle: React.CSSProperties = { marginBottom: 24 }
const breadcrumbStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-500)',
  marginBottom: 8,
}
const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  margin: '0 0 4px 0',
}
const metaStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-600)',
}
const stickyBarStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 10,
  backgroundColor: 'var(--theme-elevation-100)',
  borderBottom: '1px solid var(--theme-elevation-200)',
  padding: '12px 16px',
  borderRadius: 4,
  marginBottom: 16,
  display: 'flex',
  gap: 16,
  alignItems: 'center',
}
const summaryStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
}
const failureCardStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  padding: 16,
  marginBottom: 12,
  backgroundColor: 'var(--theme-elevation-0)',
}
const exerciseRefStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-500)',
  marginBottom: 8,
}
const failureRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
  padding: '8px 0',
  borderTop: '1px solid var(--theme-elevation-100)',
}
const codeStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 12,
  backgroundColor: 'var(--theme-elevation-100)',
  padding: '2px 6px',
  borderRadius: 3,
  whiteSpace: 'nowrap',
}
const messageStyle: React.CSSProperties = { fontSize: 13, flex: 1 }
const buttonStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  cursor: 'pointer',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 3,
  backgroundColor: 'var(--theme-elevation-0)',
}
const regenerateDropdownStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: 4,
}
const loadingStyle: React.CSSProperties = {
  padding: 40,
  textAlign: 'center' as const,
  fontSize: 14,
}
const resolvedBannerStyle: React.CSSProperties = {
  padding: '16px 24px',
  textAlign: 'center',
  fontSize: 16,
  fontWeight: 500,
  color: 'var(--theme-success)',
  backgroundColor: 'rgba(16, 185, 129, 0.1)',
  borderRadius: 4,
  border: '1px solid var(--theme-success)',
}

// --- Component ---
export function LessonDuplicationReview({ duplicationId }: { duplicationId: string }) {
  const [record, setRecord] = useState<DuplicationRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingActions, setPendingActions] = useState<
    Map<number, { action: Action; level?: RegenLevel }>
  >(new Map())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [allResolved, setAllResolved] = useState(false)
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
  const diffPreviewRef = useRef<HTMLDivElement>(null)

  const fetchRecord = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/lesson-duplications/${duplicationId}/record`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const r = (data.data ?? data) as DuplicationRecord
      setRecord(r)
      setAllResolved(r.status === 'succeeded')

      // Pre-populate reviewedIds from existing resolved failures
      const reviewed = new Set<string>()
      for (const f of r.failures) {
        if (f.resolved) {
          // Find the output exercise for this exerciseRef
          const pair = r.exercisePairs?.find((p) => p.sourceExerciseId === f.exerciseRef)
          if (pair) reviewed.add(pair.outputExerciseId)
        }
      }
      setReviewedIds(reviewed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load record')
    } finally {
      setIsLoading(false)
    }
  }, [duplicationId])

  useEffect(() => {
    fetchRecord()
  }, [fetchRecord])

  const unresolvedCount = record?.failures.filter((f) => !f.resolved).length ?? 0
  const totalExercises = record?.exercisePairs?.length ?? record?.outputExercises?.length ?? 0

  async function handleSubmit() {
    if (pendingActions.size === 0) return
    setIsSubmitting(true)
    setSubmitError(null)
    const actions = Array.from(pendingActions.entries()).map(([idx, v]) => ({
      failureIndex: idx,
      action: v.action,
      level: v.level,
    }))
    try {
      const res = await fetch(`/api/lesson-duplications/${duplicationId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ actions }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? data.error ?? `HTTP ${res.status}`)
      setPendingActions(new Map())
      await fetchRecord()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  function setAction(index: number, action: Action, level?: RegenLevel) {
    setPendingActions((prev) => {
      const next = new Map(prev)
      next.set(index, { action, level })
      return next
    })
  }

  function jumpToExercise(outputExerciseId: string) {
    document
      .getElementById(outputExerciseId)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // Handle looks_right from DiffPreview — resolves all failures for this exercise
  function handleLooksRight(outputExerciseId: string) {
    if (!record) return
    const pair = record.exercisePairs?.find((p) => p.outputExerciseId === outputExerciseId)
    if (!pair) return

    // Find the failure indices for this exercise
    const failureIndices: number[] = []
    for (let i = 0; i < record.failures.length; i++) {
      if (
        record.failures[i].exerciseRef === pair.sourceExerciseId &&
        !record.failures[i].resolved
      ) {
        failureIndices.push(i)
      }
    }

    // Set actions for all failure indices
    setPendingActions((prev) => {
      const next = new Map(prev)
      for (const idx of failureIndices) {
        next.set(idx, { action: 'looks_right' })
      }
      return next
    })

    setReviewedIds((prev) => {
      const next = new Set(prev)
      next.add(outputExerciseId)
      return next
    })
  }

  // Handle regenerate from DiffPreview
  function handleRegenerate(outputExerciseId: string, level: RegenLevel) {
    if (!record) return
    const pair = record.exercisePairs?.find((p) => p.outputExerciseId === outputExerciseId)
    if (!pair) return

    const failureIdx = record.failures.findIndex(
      (f) => f.exerciseRef === pair.sourceExerciseId && !f.resolved,
    )
    if (failureIdx >= 0) {
      setPendingActions((prev) => {
        const next = new Map(prev)
        next.set(failureIdx, { action: 'regenerate', level })
        return next
      })
    }
  }

  // Handle skip from DiffPreview
  function handleSkip(outputExerciseId: string) {
    if (!record) return
    const pair = record.exercisePairs?.find((p) => p.outputExerciseId === outputExerciseId)
    if (!pair) return

    const failureIdx = record.failures.findIndex(
      (f) => f.exerciseRef === pair.sourceExerciseId && !f.resolved,
    )
    if (failureIdx >= 0) {
      setPendingActions((prev) => {
        const next = new Map(prev)
        next.set(failureIdx, { action: 'skip' })
        return next
      })
    }
  }

  if (isLoading) return <div style={loadingStyle}>Loading…</div>
  if (error) return <div style={{ ...loadingStyle, color: 'var(--theme-error)' }}>{error}</div>
  if (!record) return null

  // Group failures by exerciseRef
  const failuresByExercise: Record<string, FailureEntry[]> = {}
  for (const f of record.failures) {
    if (!f.resolved) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      ;(failuresByExercise[f.exerciseRef] ??= []).push(f)
    }
  }
  const exerciseGroups = Object.entries(failuresByExercise)

  const sourceLessonTitle =
    typeof record.sourceLesson === 'object' && record.sourceLesson !== null
      ? ((record.sourceLesson as { title?: string }).title ??
        (record.sourceLesson as { id: string }).id)
      : (record.sourceLesson ?? 'Unknown')

  if (allResolved) {
    return (
      <div style={pageStyle}>
        <div style={resolvedBannerStyle}>
          ✓ All failures resolved — duplication finalized to <em>succeeded</em>.{' '}
          <Link href="/admin/collections/lesson-duplications" style={{ color: 'inherit' }}>
            Back to list
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <p style={breadcrumbStyle}>
          <Link href="/admin">Dashboard</Link> /{' '}
          <Link href="/admin/collections/lesson-duplications">Lesson Duplications</Link> / Review
        </p>
        <h1 style={titleStyle}>Lesson Duplication Review</h1>
        <p style={metaStyle}>
          Source: <strong>{sourceLessonTitle ?? record.sourceLesson}</strong> · Level:{' '}
          <strong>{record.level}</strong> · Status: <strong>{record.status}</strong>
        </p>
      </div>

      {/* Sticky summary bar */}
      <div style={stickyBarStyle}>
        <span style={summaryStyle}>
          {reviewedIds.size} of {totalExercises} exercises reviewed
          {unresolvedCount > 0 ? (
            <span className="text-destructive" style={{ marginLeft: 8 }}>
              · {unresolvedCount} failure{unresolvedCount !== 1 ? 's' : ''} remaining
            </span>
          ) : (
            <span className="text-[var(--theme-success)]" style={{ marginLeft: 8 }}>
              · all reviewed
            </span>
          )}
        </span>
        <div style={{ flex: 1 }} />
        {pendingActions.size > 0 && (
          <>
            <span style={{ fontSize: 13, color: 'var(--theme-elevation-600)' }}>
              {pendingActions.size} action{pendingActions.size !== 1 ? 's' : ''} pending
            </span>
            <button
              style={{
                ...buttonStyle,
                backgroundColor: 'var(--theme-success)',
                color: '#fff',
                border: 'none',
              }}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Applying…' : 'Apply Actions'}
            </button>
          </>
        )}
      </div>

      {submitError && (
        <div style={{ color: 'var(--theme-error)', fontSize: 13, marginBottom: 12 }}>
          {submitError}
        </div>
      )}

      {/* Diff Preview — above failures list */}
      {record.exercisePairs && record.exercisePairs.length > 0 && (
        <div ref={diffPreviewRef} style={{ marginBottom: 24 }}>
          <DiffPreview
            exercisePairs={record.exercisePairs}
            failures={record.failures}
            reviewedIds={reviewedIds}
            onLooksRight={handleLooksRight}
            onRegenerate={handleRegenerate}
            onSkip={handleSkip}
            onJumpToExercise={jumpToExercise}
          />
        </div>
      )}

      {/* Failures */}
      {exerciseGroups.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--theme-elevation-500)' }}>No unresolved failures.</p>
      ) : (
        exerciseGroups.map(([exerciseRef, failures]) => {
          const firstFailure = failures[0]
          const globalIndex = record.failures.findIndex(
            (f) => f.exerciseRef === exerciseRef && f.code === firstFailure.code && !f.resolved,
          )
          const _pending = pendingActions.get(globalIndex)

          return (
            <div key={exerciseRef} style={failureCardStyle}>
              <div style={exerciseRefStyle}>
                Exercise: <code>{exerciseRef.slice(0, 12)}…</code>
                {failures.length > 1 && ` (${failures.length} failures)`}
                {' · '}
                <a
                  href={`/admin/collections/exercises/${exerciseRef}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--theme-elevation-700)',
                    fontSize: 12,
                  }}
                >
                  View source
                </a>
                {record.exercisePairs && (
                  <>
                    {' · '}
                    <button
                      onClick={() => {
                        const pair = record.exercisePairs?.find(
                          (p) => p.sourceExerciseId === exerciseRef,
                        )
                        if (pair) jumpToExercise(pair.outputExerciseId)
                      }}
                      style={{
                        color: 'var(--theme-primary)',
                        fontSize: 12,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Jump to exercise
                    </button>
                  </>
                )}
              </div>
              {failures.map((failure) => {
                const idx = record.failures.findIndex(
                  (f) =>
                    f.exerciseRef === exerciseRef &&
                    f.code === failure.code &&
                    f.sectionIndex === failure.sectionIndex &&
                    !f.resolved,
                )
                const pendingForRow = pendingActions.get(idx)

                return (
                  <div key={`${failure.code}-${failure.sectionIndex}`} style={failureRowStyle}>
                    <span style={codeStyle}>{failure.code}</span>
                    <span style={messageStyle}>{failure.message}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        style={{
                          ...buttonStyle,
                          ...(pendingForRow?.action === 'skip'
                            ? { borderColor: 'var(--theme-error)', color: 'var(--theme-error)' }
                            : {}),
                        }}
                        onClick={() => setAction(idx, 'skip')}
                      >
                        Skip
                      </button>
                      <div style={regenerateDropdownStyle}>
                        {(['light', 'medium', 'deep'] as RegenLevel[]).map((lvl) => (
                          <button
                            key={lvl}
                            style={{
                              ...buttonStyle,
                              padding: '4px 8px',
                              fontSize: 11,
                              ...(pendingForRow?.action === 'regenerate' &&
                              pendingForRow.level === lvl
                                ? {
                                    borderColor: 'var(--theme-warning)',
                                    color: 'var(--theme-warning)',
                                  }
                                : {}),
                            }}
                            onClick={() => setAction(idx, 'regenerate', lvl)}
                          >
                            Regenerate ({lvl})
                          </button>
                        ))}
                      </div>
                      <button
                        style={{
                          ...buttonStyle,
                          ...(pendingForRow?.action === 'keep'
                            ? {
                                borderColor: 'var(--theme-success)',
                                color: 'var(--theme-success)',
                              }
                            : {}),
                        }}
                        onClick={() => setAction(idx, 'keep')}
                      >
                        Keep
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}
