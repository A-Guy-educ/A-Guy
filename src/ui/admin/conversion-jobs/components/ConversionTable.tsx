/**
 * Conversion Jobs Table
 *
 * @fileType component
 * @domain admin
 * @pattern data-table
 * @ai-summary Table displaying conversion jobs with status and actions
 */

'use client'

import Link from 'next/link'
import type { ConversionJob } from '../hooks/useConversionJobs'

interface ConversionTableProps {
  jobs: ConversionJob[]
  isLoading: boolean
  onRowClick?: (job: ConversionJob) => void
}

const STATUS_CLASSES: Record<string, string> = {
  draft: 'status-draft',
  queued: 'status-queued',
  running: 'status-running',
  paused: 'status-paused',
  review: 'status-review',
  completed: 'status-completed',
  failed: 'status-failed',
  cancelled: 'status-cancelled',
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function calculateProgress(job: ConversionJob): number {
  if (job.progress.totalSegments === 0) return 0
  return Math.round((job.progress.completedSegments / job.progress.totalSegments) * 100)
}

export function ConversionTable({ jobs, isLoading, onRowClick }: ConversionTableProps) {
  if (isLoading) {
    return (
      <div className="conversion-table-loading">
        <div className="loading-spinner" />
        <p>Loading jobs...</p>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="conversion-table-empty">
        <p>No conversion jobs found.</p>
        <p>Create a new conversion from the lesson page.</p>
      </div>
    )
  }

  return (
    <div className="conversion-table-container">
      <table className="conversion-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Stage</th>
            <th>Progress</th>
            <th>Lesson</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} onClick={() => onRowClick?.(job)} className="conversion-table-row">
              <td className="job-title">{job.title}</td>
              <td>
                <span className={`status-badge ${STATUS_CLASSES[job.status]}`}>{job.status}</span>
              </td>
              <td className="job-stage">{job.currentStage}</td>
              <td className="job-progress">
                <div className="progress-bar-container">
                  <div className="progress-bar" style={{ width: `${calculateProgress(job)}%` }} />
                </div>
                <span className="progress-text">
                  {job.progress.completedSegments}/{job.progress.totalSegments} segments
                </span>
              </td>
              <td className="job-lesson">
                {job.lesson?.title || <span className="text-muted">—</span>}
              </td>
              <td className="job-date">{formatDate(job.createdAt)}</td>
              <td className="job-actions">
                <Link href={`/admin/conversion-jobs/${job.id}`} className="action-view">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        .conversion-table-container {
          overflow-x: auto;
          background: var(--theme-elevation-100);
          border-radius: 8px;
        }
        .conversion-table {
          width: 100%;
          border-collapse: collapse;
        }
        .conversion-table th,
        .conversion-table td {
          padding: 0.75rem 1rem;
          text-align: left;
          border-bottom: 1px solid var(--theme-elevation-200);
        }
        .conversion-table th {
          background: var(--theme-elevation-150);
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--theme-elevation-800);
        }
        .conversion-table-row {
          cursor: pointer;
          transition: background 0.15s;
        }
        .conversion-table-row:hover {
          background: var(--theme-elevation-200);
        }
        .conversion-table-row:last-child td {
          border-bottom: none;
        }
        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
        }
        .status-draft { background: #e5e7eb; color: #374151; }
        .status-queued { background: #dbeafe; color: #1d4ed8; }
        .status-running { background: #dcfce7; color: #16a34a; }
        .status-paused { background: #fef9c3; color: #a16207; }
        .status-review { background: #ffedd5; color: #c2410c; }
        .status-completed { background: #dcfce7; color: #16a34a; }
        .status-failed { background: #fee2e2; color: #dc2626; }
        .status-cancelled { background: #e5e7eb; color: #6b7280; }
        .progress-bar-container {
          width: 100px;
          height: 6px;
          background: var(--theme-elevation-300);
          border-radius: 3px;
          overflow: hidden;
          display: inline-block;
          margin-right: 0.5rem;
        }
        .progress-bar {
          height: 100%;
          background: var(--theme-success);
          transition: width 0.3s;
        }
        .progress-text {
          font-size: 0.75rem;
          color: var(--theme-elevation-500);
        }
        .action-view {
          padding: 0.25rem 0.5rem;
          background: var(--theme-elevation-200);
          border-radius: 4px;
          font-size: 0.75rem;
          color: var(--theme-elevation-800);
          text-decoration: none;
        }
        .action-view:hover {
          background: var(--theme-elevation-300);
        }
        .conversion-table-loading,
        .conversion-table-empty {
          padding: 3rem;
          text-align: center;
          color: var(--theme-elevation-500);
        }
        .loading-spinner {
          width: 2rem;
          height: 2rem;
          border: 2px solid var(--theme-elevation-200);
          border-top-color: var(--theme-elevation-500);
          border-radius: 50%;
          margin: 0 auto 1rem;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
