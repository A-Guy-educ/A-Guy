/**
 * Exercise Generation Review Component
 *
 * @fileType component
 * @domain admin
 * @pattern review-list
 * @ai-summary Admin review UI for exercise generation. Shows status and allows continuing generation.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface FailureEntry {
  exerciseRef: string
  sectionIndex: number
  code: string
  message: string
  suggestedAction: string
  resolved: boolean
}

interface OutputExerciseEntry {
  exerciseId: string
  position: number
}

interface GenerationRecord {
  id: string
  lesson: { id: string; title?: string } | string
  prompt: string
  maxCount: number
  difficultyLevel: string
  status: string
  outputExercises: OutputExerciseEntry[]
  failures: FailureEntry[]
  aiTokensInput: number
  aiTokensOutput: number
  aiCostUsd: number
  runDurationMs: number
}

// --- Styles ---
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
const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 14,
  cursor: 'pointer',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  backgroundColor: 'var(--theme-elevation-0)',
}
const statCardStyle: React.CSSProperties = {
  padding: 16,
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  backgroundColor: 'var(--theme-elevation-0)',
  textAlign: 'center' as const,
}
const statValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 600,
  color: 'var(--theme-elevation-1000)',
}
const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--theme-elevation-500)',
  marginTop: 4,
}

// --- Component ---
export function ExerciseGenerationReview({ generationId }: { generationId: string }) {
  const [record, setRecord] = useState<GenerationRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)
  const [processOutcome, setProcessOutcome] = useState<string | null>(null)

  const fetchRecord = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exercise-generations/${generationId}/record`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const r = (data.data ?? data) as GenerationRecord
      setRecord(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load record')
    } finally {
      setIsLoading(false)
    }
  }, [generationId])

  useEffect(() => {
    fetchRecord()
  }, [fetchRecord])

  // Auto-refresh every 30 seconds for running records
  useEffect(() => {
    if (record?.status === 'running') {
      const interval = setInterval(() => {
        fetchRecord()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [record?.status, fetchRecord])

  async function handleProcessNow() {
    setIsProcessing(true)
    setProcessError(null)
    setProcessOutcome(null)
    try {
      const res = await fetch(`/api/exercise-generations/${generationId}/process-now`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? data.error ?? `HTTP ${res.status}`)
      setProcessOutcome(data.data?.outcome ?? 'unknown')
      await fetchRecord()
    } catch (e) {
      setProcessError(e instanceof Error ? e.message : 'Process failed')
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) return <div style={loadingStyle}>Loading…</div>
  if (error) return <div style={{ ...loadingStyle, color: 'var(--theme-error)' }}>{error}</div>
  if (!record) return null

  const lessonTitle =
    typeof record.lesson === 'object' && record.lesson !== null
      ? ((record.lesson as { title?: string }).title ?? (record.lesson as { id: string }).id)
      : (record.lesson ?? 'Unknown')

  const succeededCount = record.outputExercises?.length ?? 0
  const failedCount = record.failures?.filter((f) => !f.resolved).length ?? 0
  const pendingCount = record.maxCount - succeededCount - failedCount

  if (record.status === 'succeeded') {
    return (
      <div style={pageStyle}>
        <div style={resolvedBannerStyle}>
          ✓ Generation completed — {succeededCount} exercises created.{' '}
          <Link
            href={`/admin/collections/lessons/${typeof record.lesson === 'object' ? record.lesson.id : record.lesson}`}
            style={{ color: 'inherit' }}
          >
            View lesson →
          </Link>
        </div>
      </div>
    )
  }

  const canProcess = record.status === 'pending' || record.status === 'running'

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <p style={breadcrumbStyle}>
          <Link href="/admin">Dashboard</Link> /{' '}
          <Link href="/admin/collections/exercise-generations">Exercise Generations</Link> / Review
        </p>
        <h1 style={titleStyle}>Exercise Generation Review</h1>
        <p style={metaStyle}>
          Lesson: <strong>{lessonTitle}</strong> · Difficulty:{' '}
          <strong>{record.difficultyLevel}</strong> · Status: <strong>{record.status}</strong>
        </p>
      </div>

      {/* Prompt */}
      <div
        style={{
          padding: 16,
          border: '1px solid var(--theme-elevation-200)',
          borderRadius: 4,
          backgroundColor: 'var(--theme-elevation-0)',
          marginBottom: 24,
        }}
      >
        <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)', marginBottom: 8 }}>PROMPT</p>
        <p style={{ fontSize: 14, margin: 0 }}>{record.prompt}</p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={statCardStyle}>
          <div style={statValueStyle}>{succeededCount}</div>
          <div style={statLabelStyle}>Succeeded</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: 'var(--theme-error)' }}>{failedCount}</div>
          <div style={statLabelStyle}>Failed</div>
        </div>
        <div style={statCardStyle}>
          <div style={statValueStyle}>{pendingCount}</div>
          <div style={statLabelStyle}>Pending</div>
        </div>
      </div>

      {/* Telemetry */}
      {(record.aiTokensInput > 0 || record.runDurationMs > 0) && (
        <div
          style={{
            display: 'flex',
            gap: 24,
            fontSize: 12,
            color: 'var(--theme-elevation-500)',
            marginBottom: 24,
          }}
        >
          {record.aiTokensInput > 0 && (
            <span>
              Tokens in: <strong>{record.aiTokensInput.toLocaleString()}</strong>
            </span>
          )}
          {record.aiTokensOutput > 0 && (
            <span>
              Tokens out: <strong>{record.aiTokensOutput.toLocaleString()}</strong>
            </span>
          )}
          {record.aiCostUsd > 0 && (
            <span>
              Est. cost: <strong>${record.aiCostUsd.toFixed(4)}</strong>
            </span>
          )}
          {record.runDurationMs > 0 && (
            <span>
              Duration: <strong>{(record.runDurationMs / 1000).toFixed(1)}s</strong>
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          padding: 16,
          border: '1px solid var(--theme-elevation-200)',
          borderRadius: 4,
          backgroundColor: 'var(--theme-elevation-0)',
        }}
      >
        {canProcess && (
          <>
            <p style={{ fontSize: 14, marginBottom: 16 }}>
              {record.status === 'pending'
                ? 'This generation is queued and will be picked up automatically by the cron worker within ~1 minute. Click below to start immediately.'
                : 'Generation is in progress. Click below to advance immediately.'}
            </p>
            <button
              style={{
                ...buttonStyle,
                backgroundColor: 'var(--theme-success)',
                color: '#fff',
                border: 'none',
              }}
              onClick={handleProcessNow}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing… (this can take several minutes)' : 'Process Now'}
            </button>
            {processOutcome && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--theme-elevation-700)' }}>
                Last run outcome: <strong>{processOutcome}</strong>
                {processOutcome === 'in_progress' &&
                  ' — more work remains; click Process Now again or wait for the next cron tick.'}
              </div>
            )}
            {processError && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--theme-error)' }}>
                {processError}
              </div>
            )}
          </>
        )}

        {record.status === 'needs_review' && (
          <p style={{ fontSize: 14, margin: 0 }}>
            Generation completed with {failedCount} failure{failedCount !== 1 ? 's' : ''}. The
            failed exercises were not created. You can view the{' '}
            <Link href={`/admin/collections/exercise-generations`}>exercise generations list</Link>{' '}
            or the{' '}
            <Link
              href={`/admin/collections/lessons/${
                typeof record.lesson === 'object' ? record.lesson.id : record.lesson
              }`}
            >
              lesson
            </Link>
            .
          </p>
        )}

        {record.status === 'failed' && (
          <p style={{ fontSize: 14, margin: 0, color: 'var(--theme-error)' }}>
            Generation failed. Check the cron worker logs for more details.
          </p>
        )}
      </div>

      {/* Failures list */}
      {record.failures && record.failures.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Failures</h2>
          {record.failures
            .filter((f) => !f.resolved)
            .map((failure, idx) => (
              <div
                key={idx}
                style={{
                  padding: 12,
                  border: '1px solid var(--theme-elevation-200)',
                  borderRadius: 4,
                  marginBottom: 8,
                  backgroundColor: 'var(--theme-elevation-0)',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 11,
                      backgroundColor: 'var(--theme-elevation-100)',
                      padding: '2px 6px',
                      borderRadius: 3,
                    }}
                  >
                    {failure.code}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                    {failure.exerciseRef}
                  </span>
                </div>
                <p style={{ fontSize: 13, margin: 0 }}>{failure.message}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
