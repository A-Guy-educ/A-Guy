'use client'

import { useEffect, useState } from 'react'

interface V2JobStatus {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  output?: {
    pagesTotal: number
    pagesProcessed: number
    exercisesCreated: number
    errors: Array<{
      pageIndex: number
      bbox?: { x: number; y: number; width: number; height: number }
      reason: string
    }>
    warnings: string[]
  }
  updatedAt: string
}

interface V2StatusPanelProps {
  lessonId: string
  mediaId: string
  onRefresh?: () => void
}

// Badge colors using Payload CSS variables
const getBadgeStyle = (status: string) => {
  switch (status) {
    case 'queued':
      return {
        backgroundColor: 'var(--theme-warning-100)',
        color: 'var(--theme-warning)',
      }
    case 'running':
      return {
        backgroundColor: 'var(--theme-info-100)',
        color: 'var(--theme-info)',
      }
    case 'completed':
      return {
        backgroundColor: 'var(--theme-success-100)',
        color: 'var(--theme-success)',
      }
    case 'failed':
      return {
        backgroundColor: 'var(--theme-error-100)',
        color: 'var(--theme-error)',
      }
    default:
      return {
        backgroundColor: 'var(--theme-elevation-200)',
        color: 'var(--theme-elevation-700)',
      }
  }
}

export function V2StatusPanel({ lessonId, mediaId, onRefresh }: V2StatusPanelProps) {
  const [status, setStatus] = useState<V2JobStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch(
          `/api/exercises/convert/status?lessonId=${lessonId}&mediaId=${mediaId}&pipelineVersion=2&limit=1`,
          { credentials: 'include' },
        )

        if (!response.ok) {
          setStatus(null)
          return
        }

        const json = await response.json()
        const docs = json.data?.docs || json.docs || []
        if (docs.length > 0) {
          setStatus(docs[0])
        } else {
          setStatus(null)
        }
      } catch {
        setStatus(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [lessonId, mediaId])

  const handleRunNow = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!status?.id) return

    setIsRunning(true)
    try {
      const response = await fetch('/api/jobs/run-immediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId: status.id }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      setStatus(null)
      setIsLoading(true)
      if (onRefresh) onRefresh()
    } catch (error) {
      alert(`Failed to run job: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRunning(false)
    }
  }

  if (isLoading) {
    return (
      <div
        style={{
          padding: 8,
          backgroundColor: 'var(--theme-elevation-100)',
          borderRadius: 4,
          color: 'var(--theme-elevation-500)',
          fontSize: 11,
        }}
      >
        Loading V2 status...
      </div>
    )
  }

  if (!status) {
    return null
  }

  const progress = status.output?.pagesTotal
    ? Math.round((status.output.pagesProcessed / status.output.pagesTotal) * 100)
    : 0

  const canRun = status.status === 'queued' || status.status === 'failed'
  const badgeStyle = getBadgeStyle(status.status)

  return (
    <div
      style={{
        padding: 8,
        backgroundColor: 'var(--theme-elevation-100)',
        borderRadius: 4,
        marginTop: 4,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--theme-elevation-700)',
          }}
        >
          V2 Conversion Status
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              ...badgeStyle,
            }}
          >
            {status.status}
          </span>
          {canRun && (
            <button
              onClick={handleRunNow}
              disabled={isRunning}
              style={{
                padding: '2px 8px',
                fontSize: 10,
                fontWeight: 500,
                border: 'none',
                borderRadius: 3,
                backgroundColor: 'var(--theme-elevation-200)',
                color: 'var(--theme-elevation-700)',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                opacity: isRunning ? 0.5 : 1,
              }}
            >
              {isRunning ? 'Running...' : 'Run Now'}
            </button>
          )}
        </div>
      </div>

      {status.status === 'running' && (
        <div
          style={{
            height: 6,
            backgroundColor: 'var(--theme-elevation-200)',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: 'var(--theme-primary)',
              transition: 'width 0.3s ease',
              width: `${progress}%`,
            }}
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 16,
          fontSize: 11,
          color: 'var(--theme-elevation-600)',
        }}
      >
        {status.output && (
          <>
            <div>
              <span style={{ color: 'var(--theme-elevation-500)', marginRight: 4 }}>Pages</span>
              <span style={{ color: 'var(--theme-elevation-900)' }}>
                {status.output.pagesProcessed} / {status.output.pagesTotal}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--theme-elevation-500)', marginRight: 4 }}>Exercises</span>
              <span style={{ color: 'var(--theme-elevation-900)' }}>
                {status.output.exercisesCreated}
              </span>
            </div>
            {status.output.errors && status.output.errors.length > 0 && (
              <div>
                <span style={{ color: 'var(--theme-error)', marginRight: 4 }}>Errors</span>
                <span style={{ color: 'var(--theme-error)' }}>{status.output.errors.length}</span>
              </div>
            )}
          </>
        )}
      </div>

      {status.output?.errors && status.output.errors.length > 0 && (
        <div
          style={{
            marginTop: 8,
            padding: 6,
            backgroundColor: 'var(--theme-error-100)',
            borderRadius: 3,
            fontSize: 10,
            color: 'var(--theme-error)',
          }}
        >
          {status.output.errors.map((error, i) => (
            <div key={i}>
              ❌ Page {error.pageIndex + 1}: {error.reason}
            </div>
          ))}
        </div>
      )}

      {status.output?.warnings && status.output.warnings.length > 0 && (
        <div
          style={{
            marginTop: 8,
            padding: 6,
            backgroundColor: 'var(--theme-warning-100)',
            borderRadius: 3,
            fontSize: 10,
            color: 'var(--theme-warning)',
          }}
        >
          {status.output.warnings.map((warning, i) => (
            <div key={i}>⚠️ {warning}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default V2StatusPanel
