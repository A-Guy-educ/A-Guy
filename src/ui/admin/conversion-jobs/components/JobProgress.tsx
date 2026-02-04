/**
 * Job Progress Component
 *
 * @fileType component
 * @domain admin
 * @pattern progress-indicator
 * @ai-summary Visual progress bar for conversion job stages
 */

'use client'

import type { ConversionJobDetail } from '../hooks/useConversionJob'

interface JobProgressProps {
  job: ConversionJobDetail
}

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

// Helper to get current stage from job (supports both old and new schema locations)
function getCurrentStage(job: ConversionJobDetail): string {
  return job.progress?.currentStage || job.currentStage || 'INIT'
}

export function JobProgress({ job }: JobProgressProps) {
  const currentStage = getCurrentStage(job)
  const currentStageIndex = STAGES.indexOf(currentStage)
  const progressPercent =
    (job.progress?.totalSegments || 0) > 0
      ? Math.round(
          ((job.progress?.completedSegments || 0) / (job.progress?.totalSegments || 1)) * 100,
        )
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
        {STAGES.map((stage, index) => (
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

      <style>{`
        .job-progress {
          background: var(--theme-elevation-100);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }
        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .progress-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .progress-label {
          font-weight: 500;
        }
        .progress-percent {
          font-size: 1.25rem;
          font-weight: 600;
        }
        .progress-stats {
          display: flex;
          gap: 1.5rem;
          font-size: 0.875rem;
          color: var(--theme-elevation-500);
        }
        .progress-bar-container {
          height: 8px;
          background: var(--theme-elevation-200);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 1.5rem;
        }
        .progress-bar {
          height: 100%;
          background: var(--theme-success);
          transition: width 0.3s ease;
        }
        .stage-tracker {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }
        .stage-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 80px;
          gap: 0.25rem;
        }
        .stage-marker {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .stage-item.completed .stage-marker {
          background: var(--theme-success);
          color: white;
        }
        .stage-item.current .stage-marker {
          background: var(--theme-primary);
          color: white;
        }
        .stage-item.pending .stage-marker {
          background: var(--theme-elevation-300);
          color: var(--theme-elevation-500);
        }
        .stage-label {
          font-size: 0.7rem;
          text-align: center;
          color: var(--theme-elevation-500);
        }
        .stage-item.completed .stage-label,
        .stage-item.current .stage-label {
          color: var(--theme-elevation-800);
          font-weight: 500;
        }
      `}</style>
    </div>
  )
}
