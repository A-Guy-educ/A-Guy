/**
 * Job History Component
 *
 * @fileType component
 * @domain admin
 * @pattern job-list
 * @ai-summary Displays list of PDF conversion jobs with status and actions
 */
'use client'

import { useCallback, useEffect, useState } from 'react'

interface JobStatus {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  input?: {
    ctx?: {
      sourceDocId?: string
    }
  }
  output?: {
    segmentsTotal?: number
    segmentsDone?: number
    segmentsFailed?: number
    exercisesCreated?: number
    errors?: Array<{
      stage: string
      code: string
      message: string
    }>
  }
  updatedAt?: string
  createdAt?: string
}

interface MediaInfo {
  id: string
  filename: string
}

interface JobHistoryProps {
  refreshKey: number
  selectedJobId: string | null
  onSelectJob: (jobId: string) => void
}

// Badge colors using Tailwind classes
const getBadgeClasses = (status: string): string => {
  switch (status) {
    case 'queued':
      return 'bg-amber-100 text-amber-800'
    case 'running':
      return 'bg-blue-100 text-blue-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function JobHistory({ refreshKey, selectedJobId, onSelectJob }: JobHistoryProps) {
  const [jobs, setJobs] = useState<JobStatus[]>([])
  const [mediaMap, setMediaMap] = useState<Record<string, MediaInfo>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/exercises/convert/status?limit=20', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch jobs')
      }

      const json = await response.json()
      const fetchedJobs: JobStatus[] = json.data?.docs || json.docs || []
      setJobs(fetchedJobs)

      // Extract media IDs to fetch filenames
      const mediaIds = fetchedJobs
        .filter((job) => job.input?.ctx?.sourceDocId)
        .map((job) => job.input!.ctx!.sourceDocId!)
        .filter(Boolean)

      if (mediaIds.length > 0) {
        const uniqueIds = [...new Set(mediaIds)]
        const mediaResponse = await fetch(
          `/api/media?where[id][in]=${uniqueIds.join(',')}&select[filename]=true&limit=20`,
          { credentials: 'include' },
        )

        if (mediaResponse.ok) {
          const mediaJson = await mediaResponse.json()
          const mediaDocs: MediaInfo[] = mediaJson.data?.docs || mediaJson.docs || []
          const newMediaMap: Record<string, MediaInfo> = {}
          mediaDocs.forEach((media) => {
            newMediaMap[media.id] = media
          })
          setMediaMap(newMediaMap)
        }
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
      setError('Failed to load job history')
    } finally {
      setIsLoading(false)
      setIsPolling(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs, refreshKey])

  // Polling: every 5s if any job is queued/running, otherwise every 30s
  useEffect(() => {
    const hasActiveJobs = jobs.some((job) => job.status === 'queued' || job.status === 'running')
    const pollInterval = hasActiveJobs ? 5000 : 30000

    const interval = setInterval(() => {
      if (!isLoading) {
        setIsPolling(true)
        fetchJobs()
      }
    }, pollInterval)

    return () => clearInterval(interval)
  }, [jobs, isLoading, fetchJobs])

  const handleRunNow = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      const response = await fetch('/api/jobs/run-immediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId }),
      })

      if (!response.ok) {
        throw new Error('Failed to run job')
      }

      // Refresh jobs after running
      setIsPolling(true)
      fetchJobs()
    } catch (err) {
      console.error('Failed to run job:', err)
      alert(`Failed to run job: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const getJobName = (job: JobStatus): string => {
    const mediaId = job.input?.ctx?.sourceDocId
    const media = mediaId ? mediaMap[mediaId] : null
    return media?.filename || mediaId?.substring(0, 8) || 'Unknown'
  }

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    )
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Job History</h3>
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Job History</h3>
        <div className="text-sm text-red-600">{error}</div>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Job History</h3>
        <div className="text-sm text-gray-500">No conversion jobs yet</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-semibold mb-3">
        Job History {isPolling && <span className="text-gray-400 animate-spin">↻</span>}
      </h3>
      <ul className="space-y-3">
        {jobs.map((job) => {
          const badgeClasses = getBadgeClasses(job.status)
          const hasErrors = job.output?.errors && job.output.errors.length > 0
          const progress = job.output?.segmentsTotal
            ? Math.round(((job.output.segmentsDone || 0) / job.output.segmentsTotal) * 100)
            : null

          return (
            <li
              key={job.id}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedJobId === job.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onSelectJob(job.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 truncate">{getJobName(job)}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${badgeClasses}`}>
                  {job.status.toUpperCase()}
                </span>
              </div>

              {job.status === 'running' && progress !== null && (
                <div className="mb-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600">{progress}%</span>
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-600 mb-1">
                {job.output?.segmentsTotal !== undefined && (
                  <span>
                    {job.output.segmentsDone || 0}/{job.output.segmentsTotal} segments
                  </span>
                )}
                {job.output?.exercisesCreated !== undefined && (
                  <span>{job.output.exercisesCreated} exercises</span>
                )}
              </div>

              <div className="text-xs text-gray-500 mb-2">
                {formatDate(job.updatedAt || job.createdAt)}
              </div>

              {hasErrors && (
                <details className="mb-2">
                  <summary className="text-sm text-red-600 cursor-pointer">
                    Show errors ({job.output?.errors?.length})
                  </summary>
                  <ul className="mt-1 text-xs text-red-700 pl-4">
                    {job.output?.errors?.map((err, idx) => (
                      <li key={idx}>
                        {err.stage}: {err.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="flex gap-2">
                {(job.status === 'queued' || job.status === 'failed') && (
                  <button
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    onClick={(e) => handleRunNow(job.id, e)}
                  >
                    Run Now
                  </button>
                )}
                {job.status === 'completed' && (
                  <button
                    className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectJob(job.id)
                    }}
                  >
                    View Exercises
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
