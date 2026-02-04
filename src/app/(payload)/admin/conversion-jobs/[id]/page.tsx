/**
 * Conversion Job Detail Page
 *
 * @fileType page
 * @domain admin
 * @pattern admin-page
 * @ai-summary Detail view for a single conversion job with progress and actions
 */

'use client'

import type { ConversionJobDetail } from '@/ui/admin/conversion-jobs/hooks/useConversionJob'
import { useConversionJob } from '@/ui/admin/conversion-jobs/hooks/useConversionJob'
import { useConversionJobActions } from '@/ui/admin/conversion-jobs/hooks/useConversionJobActions'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'

const STAGES = [
  'INIT',
  'PDF_PREVIEW',
  'CONFIGURATION',
  'PDF_LOAD',
  'PDF_SEGMENT',
  'SEGMENT_QUEUE',
  'SEGMENT_EXTRACT',
  'SEGMENT_REVIEW',
  'ROUND_PROCESSING',
  'SEGMENT_VERIFY',
  'VERIFICATION_REVIEW',
  'SEGMENT_PERSIST',
  'FINAL_APPROVAL',
  'COMPLETE',
]

const STAGE_LABELS: Record<string, string> = {
  INIT: 'Initializing',
  PDF_PREVIEW: 'PDF Preview',
  CONFIGURATION: 'Configuration',
  PDF_LOAD: 'Loading PDF',
  PDF_SEGMENT: 'Segmenting PDF',
  SEGMENT_QUEUE: 'Queueing Segments',
  SEGMENT_EXTRACT: 'Extracting',
  SEGMENT_REVIEW: 'Segment Review',
  ROUND_PROCESSING: 'Enrichment Rounds',
  SEGMENT_VERIFY: 'Verifying',
  VERIFICATION_REVIEW: 'Final Review',
  SEGMENT_PERSIST: 'Saving',
  FINAL_APPROVAL: 'Final Approval',
  COMPLETE: 'Complete',
}

function JobProgress({ job }: { job: ConversionJobDetail }) {
  const currentStageIndex = STAGES.indexOf(job.currentStage)
  const progressPercent =
    job.progress.totalSegments > 0
      ? Math.round((job.progress.completedSegments / job.progress.totalSegments) * 100)
      : 0

  return (
    <div className="job-progress">
      <div className="progress-header">
        <div className="progress-info">
          <span className="progress-label">Overall Progress</span>
          <span className="progress-percent">{progressPercent}%</span>
        </div>
        <div className="progress-stats">
          <span>
            {job.progress.completedSegments} / {job.progress.totalSegments} segments
          </span>
          <span>
            {job.progress.completedExercises} / {job.progress.totalExercises} exercises
          </span>
        </div>
      </div>
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="stage-tracker">
        {STAGES.slice(0, 8).map((stage, index) => (
          <div
            key={stage}
            className={`stage-item ${
              index < currentStageIndex
                ? 'completed'
                : index === currentStageIndex
                  ? 'current'
                  : 'pending'
            }`}
          >
            <div className="stage-marker">{index < currentStageIndex ? '✓' : index + 1}</div>
            <span className="stage-label">{STAGE_LABELS[stage]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function JobLogs({
  logs,
}: {
  logs: Array<{ timestamp: string; level: string; stage: string; message: string }>
}) {
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all')
  const [search, setSearch] = useState('')

  const filteredLogs = logs.filter((log) => {
    if (filter !== 'all' && log.level !== filter) return false
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <section className="job-logs">
      <div className="logs-header">
        <h2>Logs</h2>
        <div className="logs-filters">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="log-search"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="log-filter"
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>
      <div className="logs-container">
        {filteredLogs.length === 0 ? (
          <p className="logs-empty">No logs.</p>
        ) : (
          <ul className="logs-list">
            {filteredLogs.map((log, i) => (
              <li key={i} className={`log-entry log-${log.level}`}>
                <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`log-level badge-${log.level}`}>{log.level}</span>
                <span className="log-message">{log.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default function ConversionJobDetailPage() {
  const params = useParams()
  const jobId = params.id as string
  const { job, isLoading, error } = useConversionJob(jobId)
  const { pauseJob, resumeJob, cancelJob } = useConversionJobActions()

  if (isLoading) {
    return (
      <div className="job-detail-loading">
        <div className="loading-spinner" />
        <p>Loading job...</p>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="job-detail-error">
        <h1>Error Loading Job</h1>
        <p>{error?.message || 'Job not found'}</p>
        <Link href="/admin/conversion-jobs" className="back-link">
          ← Back to Jobs
        </Link>
      </div>
    )
  }

  const handlePause = async () => {
    await pauseJob(job.id)
  }
  const handleResume = async () => {
    await resumeJob(job.id)
  }
  const handleCancel = async () => {
    if (confirm('Cancel this job?')) {
      await cancelJob(job.id)
    }
  }

  return (
    <div className="conversion-job-detail">
      <header className="page-header">
        <Link href="/admin/conversion-jobs" className="back-link">
          ← Back to Jobs
        </Link>
        <div className="header-content">
          <h1>{job.title}</h1>
          <div className="header-meta">
            <span className={`status-badge status-${job.status}`}>{job.status}</span>
            <span className="stage-label">{job.currentStage}</span>
          </div>
        </div>
        <div className="header-actions">
          {job.status === 'running' && (
            <button onClick={handlePause} className="action-btn btn-pause">
              Pause
            </button>
          )}
          {job.status === 'paused' && (
            <button onClick={handleResume} className="action-btn btn-resume">
              Resume
            </button>
          )}
          {['queued', 'running', 'paused', 'review'].includes(job.status) && (
            <button onClick={handleCancel} className="action-btn btn-cancel">
              Cancel
            </button>
          )}
        </div>
      </header>

      <JobProgress job={job} />

      <div className="job-content">
        <div className="job-tabs">
          <section className="tab-panel">
            <h2>Segments</h2>
            {job.segments?.length ? (
              <ul className="segment-list">
                {job.segments.map((seg) => (
                  <li key={seg.id} className="segment-item">
                    <span className="segment-pages">
                      Pages {seg.pageRange.start}-{seg.pageRange.end}
                    </span>
                    <span className={`segment-status status-${seg.status}`}>{seg.status}</span>
                    <span className="segment-exercises">{seg.exerciseCount} exercises</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No segments yet.</p>
            )}
          </section>
          <section className="tab-panel">
            <h2>Pending Review</h2>
            {job.pendingExercises?.length ? (
              <ul className="exercise-list">
                {job.pendingExercises.map((ex) => (
                  <li key={ex.id} className="exercise-item">
                    <span className="exercise-title">{ex.title}</span>
                    <span className="exercise-scores">
                      {ex.qualityScores &&
                        `Conf: ${Math.round(ex.qualityScores.confidence * 100)}%`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No exercises pending.</p>
            )}
          </section>
        </div>
        <JobLogs logs={job.logs || []} />
      </div>

      <style>{`
        .conversion-job-detail { padding: 1.5rem; max-width: 1400px; margin: 0 auto; }
        .page-header { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--theme-elevation-200); }
        .back-link { color: var(--theme-elevation-500); text-decoration: none; font-size: 0.875rem; padding: 0.5rem 0; }
        .header-content { flex: 1; }
        .header-content h1 { font-size: 1.5rem; font-weight: 600; margin: 0; }
        .header-meta { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.5rem; }
        .status-badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; text-transform: uppercase; }
        .status-draft { background: #e5e7eb; color: #374151; }
        .status-queued { background: #dbeafe; color: #1d4ed8; }
        .status-running { background: #dcfce7; color: #16a34a; }
        .status-paused { background: #fef9c3; color: #a16207; }
        .status-review { background: #ffedd5; color: #c2410c; }
        .status-completed { background: #dcfce7; color: #16a34a; }
        .status-failed { background: #fee2e2; color: #dc2626; }
        .stage-label { color: var(--theme-elevation-500); font-size: 0.875rem; }
        .header-actions { display: flex; gap: 0.5rem; }
        .action-btn { padding: 0.5rem 1rem; border-radius: 4px; font-size: 0.875rem; cursor: pointer; border: none; }
        .btn-pause { background: #fef9c3; color: #a16207; }
        .btn-resume { background: #dbeafe; color: #1d4ed8; }
        .btn-cancel { background: #fee2e2; color: #dc2626; }
        .job-content { display: grid; grid-template-columns: 1fr 400px; gap: 1.5rem; }
        .job-tabs { display: flex; flex-direction: column; gap: 1rem; }
        .tab-panel { background: var(--theme-elevation-100); border-radius: 8px; padding: 1rem; }
        .tab-panel h2 { font-size: 1rem; font-weight: 600; margin: 0 0 0.75rem; }
        .segment-list, .exercise-list { list-style: none; padding: 0; margin: 0; }
        .segment-item, .exercise-item { display: flex; align-items: center; gap: 1rem; padding: 0.5rem; border-radius: 4px; background: var(--theme-elevation-50); }
        .segment-pages, .exercise-title { flex: 1; font-weight: 500; }
        .segment-status { padding: 0.125rem 0.375rem; border-radius: 3px; font-size: 0.7rem; text-transform: uppercase; }
        .segment-exercises, .exercise-scores { color: var(--theme-elevation-500); font-size: 0.75rem; }
        .empty-state { color: var(--theme-elevation-500); font-style: italic; }
        .job-progress { background: var(--theme-elevation-100); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; }
        .progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .progress-label { font-weight: 500; }
        .progress-percent { font-size: 1.25rem; font-weight: 600; }
        .progress-stats { display: flex; gap: 1.5rem; font-size: 0.875rem; color: var(--theme-elevation-500); }
        .progress-bar-container { height: 8px; background: var(--theme-elevation-200); border-radius: 4px; overflow: hidden; margin-bottom: 1rem; }
        .progress-bar { height: 100%; background: var(--theme-success); transition: width 0.3s; }
        .stage-tracker { display: flex; gap: 0.5rem; overflow-x: auto; }
        .stage-item { display: flex; flex-direction: column; align-items: center; min-width: 70px; gap: 0.25rem; }
        .stage-marker { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 600; }
        .stage-item.completed .stage-marker { background: var(--theme-success); color: white; }
        .stage-item.current .stage-marker { background: var(--theme-primary); color: white; }
        .stage-item.pending .stage-marker { background: var(--theme-elevation-300); color: var(--theme-elevation-500); }
        .stage-label { font-size: 0.65rem; text-align: center; color: var(--theme-elevation-500); }
        .job-logs { background: var(--theme-elevation-100); border-radius: 8px; padding: 1rem; max-height: 500px; display: flex; flex-direction: column; }
        .logs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
        .logs-header h2 { font-size: 1rem; font-weight: 600; margin: 0; }
        .logs-filters { display: flex; gap: 0.5rem; }
        .log-search, .log-filter { padding: 0.375rem 0.5rem; border: 1px solid var(--theme-elevation-300); border-radius: 4px; font-size: 0.8rem; }
        .logs-container { flex: 1; overflow-y: auto; background: #1e1e1e; border-radius: 4px; padding: 0.5rem; }
        .logs-list { list-style: none; padding: 0; margin: 0; font-family: monospace; font-size: 0.8rem; }
        .log-entry { display: flex; gap: 0.75rem; padding: 0.25rem 0; border-bottom: 1px solid #333; }
        .log-time { color: #666; min-width: 60px; }
        .log-level { min-width: 40px; text-transform: uppercase; font-size: 0.7rem; font-weight: 600; }
        .badge-info { color: #4ade80; }
        .badge-warn { color: #facc15; }
        .badge-error { color: #f87171; }
        .log-message { color: #e5e5e5; flex: 1; }
        .logs-empty { color: #666; font-style: italic; text-align: center; padding: 2rem; }
        .job-detail-loading, .job-detail-error { padding: 3rem; text-align: center; }
        .loading-spinner { width: 2rem; height: 2rem; border: 2px solid var(--theme-elevation-200); border-top-color: var(--theme-elevation-500); border-radius: 50%; margin: 0 auto 1rem; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
