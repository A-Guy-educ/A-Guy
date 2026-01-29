'use client'

import React, { useState, useEffect } from 'react'
import { buildJobsWhereQuery } from '@/lib/exercise-conversion/helpers'

interface ConversionStatusPanelProps {
  lessonId: string
  mediaId: string
  onViewExercises?: () => void
}

// v2.1 Fix 6: Include exercisesSkipped and richer error fields
interface JobStatus {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  output?: {
    segmentsTotal: number
    segmentsDone: number
    segmentsFailed: number
    exercisesCreated: number
    exercisesDeduped: number
    exercisesSkipped?: number // v2.1: Exercises that failed verification after retry
    errors: Array<{
      stage: string
      code: string
      message: string
      exerciseTitle?: string // v2.1: Title of skipped exercise
      skipped?: boolean // v2.1: True if exercise was skipped
    }>
  }
  updatedAt: string
}

export function ConversionStatusPanel({ lessonId, mediaId, onViewExercises }: ConversionStatusPanelProps) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStatus() {
      try {
        // Fetch from Payload Jobs REST API with proper where clause
        // Use relative URL to avoid cross-origin cookie issues
        const where = encodeURIComponent(
          JSON.stringify(buildJobsWhereQuery(lessonId, mediaId))
        )

        const response = await fetch(`/api/jobs?where=${where}&limit=1&sort=-createdAt`)
        if (response.ok) {
          const data = await response.json()
          if (data.docs && data.docs.length > 0) {
            setStatus(data.docs[0])
          }
        }
      } catch (err) {
        // Silently fail - no active job
      } finally {
        setIsLoading(false)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [lessonId, mediaId])

  if (isLoading) {
    return <div className="conversion-status loading">Loading status...</div>
  }

  if (!status) {
    return null
  }

  const progress = status.output?.segmentsTotal
    ? Math.round((status.output.segmentsDone / status.output.segmentsTotal) * 100)
    : 0

  return (
    <div className={`conversion-status ${status.status}`}>
      <div className="status-header">
        <h3>Conversion Status</h3>
        <span className={`badge badge-${status.status}`}>{status.status}</span>
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
                {status.output.exercisesDeduped > 0 && ` (${status.output.exercisesDeduped} deduped)`}
                {/* v2.1 Fix 6: Show skipped count */}
                {status.output.exercisesSkipped && status.output.exercisesSkipped > 0 && (
                  <span className="skipped"> ({status.output.exercisesSkipped} skipped)</span>
                )}
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
