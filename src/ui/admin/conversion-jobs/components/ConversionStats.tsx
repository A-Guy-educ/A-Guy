/**
 * Conversion Jobs Statistics Panel
 *
 * @fileType component
 * @domain admin
 * @pattern stats-component
 * @ai-summary Statistics panel showing job counts by status
 */

'use client'

import type { ConversionJob } from '../hooks/useConversionJobs'

interface ConversionStatsProps {
  jobs: ConversionJob[]
  className?: string
}

export function ConversionStats({ jobs, className = '' }: ConversionStatsProps) {
  const stats = jobs.reduce(
    (acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const totalJobs = jobs.length
  const activeJobs = (stats.running || 0) + (stats.queued || 0) + (stats.paused || 0)

  return (
    <div className={`conversion-stats ${className}`}>
      <div className="stat-card stat-total">
        <span className="stat-value">{totalJobs}</span>
        <span className="stat-label">Total Jobs</span>
      </div>
      <div className="stat-card stat-active">
        <span className="stat-value">{activeJobs}</span>
        <span className="stat-label">Active</span>
      </div>
      <div className="stat-card stat-completed">
        <span className="stat-value">{stats.completed || 0}</span>
        <span className="stat-label">Completed</span>
      </div>
      <div className="stat-card stat-failed">
        <span className="stat-value">{stats.failed || 0}</span>
        <span className="stat-label">Failed</span>
      </div>

      <style>{`
        .conversion-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .stat-card {
          padding: 1rem;
          border-radius: 8px;
          background: var(--theme-elevation-100);
          text-align: center;
        }
        .stat-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 600;
        }
        .stat-label {
          display: block;
          font-size: 0.875rem;
          color: var(--theme-elevation-500);
          margin-top: 0.25rem;
        }
        .stat-total { background: var(--theme-elevation-200); }
        .stat-active { background: #dbeafe; }
        .stat-completed { background: #dcfce7; }
        .stat-failed { background: #fee2e2; }
      `}</style>
    </div>
  )
}
