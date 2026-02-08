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
import {
  cardStyle,
  getBadgeStyle,
  jobCardSelectedStyle,
  jobCardStyle,
  progressBarContainerStyle,
  progressBarFillStyle,
  sectionHeadingStyle,
} from '../styles'

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

const loadingStyle: React.CSSProperties = {
  ...cardStyle,
}

const errorStyle: React.CSSProperties = {
  ...cardStyle,
}

const emptyStyle: React.CSSProperties = {
  ...cardStyle,
}

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
}

const pollingStyle: React.CSSProperties = {
  color: 'var(--theme-elevation-400)',
  fontSize: 16,
  animation: 'spin 1s linear infinite',
}

const jobCardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
}

const jobNameStyle: React.CSSProperties = {
  fontWeight: 500,
  color: 'var(--theme-elevation-1000)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const progressContainerStyle: React.CSSProperties = {
  marginBottom: 8,
}

const progressTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--theme-elevation-600)',
  marginTop: 4,
}

const statsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  fontSize: 13,
  color: 'var(--theme-elevation-600)',
  marginBottom: 4,
}

const dateStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--theme-elevation-500)',
  marginBottom: 8,
}

const errorSummaryStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-error)',
  cursor: 'pointer',
  marginBottom: 8,
}

const errorListStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--theme-error)',
  paddingLeft: 16,
  marginTop: 4,
}

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
}

const runNowButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 13,
  backgroundColor: 'var(--theme-elevation-200)',
  color: 'var(--theme-elevation-800)',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
}

const viewButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 13,
  backgroundColor: 'var(--theme-elevation-100)',
  color: 'var(--theme-info)',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
}

// Add spin animation via style tag
const spinAnimation = (
  <style>{`
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `}</style>
)

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
      <div style={loadingStyle}>
        <h3 style={sectionHeadingStyle}>Job History</h3>
        <div style={{ fontSize: 13, color: 'var(--theme-elevation-500)' }}>Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={errorStyle}>
        <h3 style={sectionHeadingStyle}>Job History</h3>
        <div style={{ fontSize: 13, color: 'var(--theme-error)' }}>{error}</div>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div style={emptyStyle}>
        <h3 style={sectionHeadingStyle}>Job History</h3>
        <div style={{ fontSize: 13, color: 'var(--theme-elevation-500)' }}>
          No conversion jobs yet
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      {spinAnimation}
      <h3 style={headerStyle}>
        <span style={sectionHeadingStyle}>Job History</span>
        {isPolling && <span style={pollingStyle}>↻</span>}
      </h3>
      <ul style={listStyle}>
        {jobs.map((job) => {
          const badgeStyleObj = getBadgeStyle(job.status)
          const hasErrors = job.output?.errors && job.output.errors.length > 0
          const progress = job.output?.segmentsTotal
            ? Math.round(((job.output.segmentsDone || 0) / job.output.segmentsTotal) * 100)
            : null

          return (
            <li
              key={job.id}
              style={selectedJobId === job.id ? jobCardSelectedStyle : jobCardStyle}
              onClick={() => onSelectJob(job.id)}
            >
              <div style={jobCardHeaderStyle}>
                <span style={jobNameStyle}>{getJobName(job)}</span>
                <span style={badgeStyleObj}>{job.status.toUpperCase()}</span>
              </div>

              {job.status === 'running' && progress !== null && (
                <div style={progressContainerStyle}>
                  <div style={progressBarContainerStyle}>
                    <div style={{ ...progressBarFillStyle, width: `${progress}%` }} />
                  </div>
                  <span style={progressTextStyle}>{progress}%</span>
                </div>
              )}

              <div style={statsStyle}>
                {job.output?.segmentsTotal !== undefined && (
                  <span>
                    {job.output.segmentsDone || 0}/{job.output.segmentsTotal} segments
                  </span>
                )}
                {job.output?.exercisesCreated !== undefined && (
                  <span>· {job.output.exercisesCreated} exercises</span>
                )}
              </div>

              <div style={dateStyle}>{formatDate(job.updatedAt || job.createdAt)}</div>

              {hasErrors && (
                <details style={{ marginBottom: 8 }}>
                  <summary style={errorSummaryStyle}>
                    Show errors ({job.output?.errors?.length})
                  </summary>
                  <ul style={errorListStyle}>
                    {job.output?.errors?.map((err, idx) => (
                      <li key={idx}>
                        {err.stage}: {err.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div style={buttonGroupStyle}>
                {(job.status === 'queued' || job.status === 'failed') && (
                  <button style={runNowButtonStyle} onClick={(e) => handleRunNow(job.id, e)}>
                    Run Now
                  </button>
                )}
                {job.status === 'completed' && (
                  <button
                    style={viewButtonStyle}
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
