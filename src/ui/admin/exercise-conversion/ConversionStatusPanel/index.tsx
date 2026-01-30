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

// Badge color classes based on status
const badgeColors = {
  queued: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
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
    } catch (error) {
      console.error('[ConversionStatusPanel] Error:', error)
      alert(`Failed to run job: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRunning(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 p-3 rounded">
        Loading status...
      </div>
    )
  }

  if (!status) {
    return null
  }

  const progress = status.output?.segmentsTotal
    ? Math.round((status.output.segmentsDone / status.output.segmentsTotal) * 100)
    : 0

  const canRun = status.status === 'queued' || status.status === 'failed'

  return (
    <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded mt-2">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium m-0">Conversion Status</h3>
        <div className="flex gap-2 items-center">
          <span
            className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${badgeColors[status.status]}`}
          >
            {status.status}
          </span>
          {canRun && (
            <button
              type="button"
              className="px-3 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded text-xs font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50"
              onClick={handleRunNow}
              disabled={isRunning}
            >
              {isRunning ? 'Running...' : '▶ Run Now'}
            </button>
          )}
        </div>
      </div>

      {status.status === 'running' && (
        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded overflow-hidden mb-2">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex gap-4 text-sm">
        {status.output && (
          <>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400 mr-1">Segments</span>
              <span>
                {status.output.segmentsDone} / {status.output.segmentsTotal}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400 mr-1">Exercises</span>
              <span>
                {status.output.exercisesCreated} created
                {status.output.exercisesDeduped > 0 &&
                  ` (${status.output.exercisesDeduped} deduped)`}
              </span>
            </div>
          </>
        )}
      </div>

      {status.status === 'completed' && onViewExercises && (
        <button
          className="mt-3 px-4 py-1.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600"
          onClick={onViewExercises}
        >
          View Created Exercises
        </button>
      )}
    </div>
  )
}
