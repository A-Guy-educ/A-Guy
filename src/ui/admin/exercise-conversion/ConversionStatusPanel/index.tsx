'use client'

import { useEffect, useState } from 'react'

interface JobStatus {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  output?: {
    segmentsTotal: number
    segmentsDone: number
    segmentsFailed: number
    exercisesCreated: number
    exercisesDeduped: number
    errors: Array<{
      stage: string
      code: string
      message: string
    }>
  }
  updatedAt: string
}

interface ConversionStatusPanelProps {
  lessonId: string
  mediaId: string
  onViewExercises?: () => void
}

export function ConversionStatusPanel({
  lessonId,
  mediaId,
  onViewExercises,
}: ConversionStatusPanelProps) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch(
          `/api/exercises/convert/status?lessonId=${lessonId}&mediaId=${mediaId}&limit=1`,
          { credentials: 'include' },
        )

        if (!response.ok) {
          setStatus(null)
          return
        }

        const data = await response.json()
        if (data.docs && data.docs.length > 0) {
          setStatus(data.docs[0])
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
      await fetch('/api/jobs/run-immediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: status.id }),
      })
      // Refresh status
      setStatus(null)
      setIsLoading(true)
    } catch (error) {
      console.error('[ConversionStatusPanel] Error:', error)
    } finally {
      setIsRunning(false)
    }
  }

  if (isLoading) {
    return <div className="conversion-status loading">Loading status...</div>
  }

  if (!status) {
    return null
  }

  const progress = status.output?.segmentsTotal
    ? Math.round((status.output.segmentsDone / status.output.segmentsTotal) * 100)
    : 0

  const canRun = status.status === 'queued' || status.status === 'failed'

  return (
    <div className={`conversion-status ${status.status}`}>
      <div className="status-header">
        <h3>Conversion Status</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className={`badge badge-${status.status}`}>{status.status}</span>
          {canRun && (
            <button
              type="button"
              className="btn btn--style-secondary"
              onClick={handleRunNow}
              disabled={isRunning}
              style={{ padding: '4px 12px', fontSize: '12px' }}
            >
              {isRunning ? 'Running...' : '▶ Run Now'}
            </button>
          )}
        </div>
      </div>

      {status.status === 'running' && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="status-details">
        {status.output && (
          <>
            <div className="stat">
              <span className="label">Segments</span>
              <span className="value">
                {status.output.segmentsDone} / {status.output.segmentsTotal}
              </span>
            </div>
            <div className="stat">
              <span className="label">Exercises</span>
              <span className="value">
                {status.output.exercisesCreated} created
                {status.output.exercisesDeduped > 0 &&
                  ` (${status.output.exercisesDeduped} deduped)`}
              </span>
            </div>
          </>
        )}
      </div>

      {status.status === 'completed' && onViewExercises && (
        <button className="btn btn-secondary" onClick={onViewExercises}>
          View Created Exercises
        </button>
      )}
    </div>
  )
}
