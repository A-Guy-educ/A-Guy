/**
 * @fileType component
 * @domain cody
 * @pattern pipeline-status
 * @ai-summary Pipeline status visualization
 */
'use client'

import { useState } from 'react'
import { cn } from '../utils'
import type { CodyPipelineStatus, StageStatus } from '../types'
import { SPEC_STAGES, IMPL_STAGES } from '../constants'
import { StageErrorDetail } from './StageErrorDetail'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getStageTooltip } from '../pipeline-utils'

interface PipelineStatusProps {
  status: CodyPipelineStatus
  className?: string
}

const stageIcons: Record<string, string> = {
  completed: '✅',
  failed: '❌',
  running: '🔄',
  pending: '⏳',
  skipped: '⚪',
  'gate-waiting': '🚫',
  paused: '⏸️',
  timeout: '⏰',
}

export function PipelineStatus({ status, className }: PipelineStatusProps) {
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({})

  const toggleStage = (stage: string) => {
    setExpandedStages((prev) => ({
      ...prev,
      [stage]: !prev[stage],
    }))
  }

  // Find failed stage for error details
  const failedStage = Object.entries(status.stages).find(
    ([, data]) => data?.state === 'failed' || data?.state === 'timeout',
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* Spec Pipeline */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
          Spec Pipeline
        </h3>
        <div className="flex items-center gap-1 flex-wrap">
          {SPEC_STAGES.map((stage, index) => {
            const stageData = status.stages[stage]
            const isFailed = stageData?.state === 'failed' || stageData?.state === 'timeout'
            return (
              <div key={stage} className="flex items-center">
                <StageIndicator
                  stage={stage}
                  data={stageData}
                  expandable={isFailed}
                  expanded={expandedStages[stage] || false}
                  onToggle={() => toggleStage(stage)}
                />
                {index < SPEC_STAGES.length - 1 && (
                  <span className="mx-1 text-muted-foreground">→</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Implementation Pipeline */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
          Implementation Pipeline
        </h3>
        <div className="flex items-center gap-1 flex-wrap">
          {IMPL_STAGES.map((stage, index) => {
            const stageData = status.stages[stage]
            const isFailed = stageData?.state === 'failed' || stageData?.state === 'timeout'
            return (
              <div key={stage} className="flex items-center">
                <StageIndicator
                  stage={stage}
                  data={stageData}
                  expandable={isFailed}
                  expanded={expandedStages[stage] || false}
                  onToggle={() => toggleStage(stage)}
                />
                {index < IMPL_STAGES.length - 1 && (
                  <span className="mx-1 text-muted-foreground">→</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Current Stage */}
      {status.currentStage && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Current:</span>
          <span className="text-foreground font-medium">{status.currentStage}</span>
        </div>
      )}

      {/* Error Details - show for failed/timeout stages */}
      {failedStage && (
        <StageErrorDetail
          stageName={failedStage[0]}
          error={failedStage[1]?.error}
          runId={status.runId ? parseInt(status.runId) : undefined}
        />
      )}
    </div>
  )
}

interface StageIndicatorProps {
  stage: string
  data?: StageStatus
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
}

function StageIndicator({ stage, data, expandable, expanded, onToggle }: StageIndicatorProps) {
  const state = data?.state || 'pending'
  const icon = stageIcons[state] || '⏳'
  const isFailed = state === 'failed' || state === 'timeout'

  return (
    <div
      className={cn(
        'flex flex-col items-center px-2 py-1 rounded',
        state === 'running' && 'bg-blue-500/20',
        isFailed && 'bg-red-500/20 cursor-pointer hover:bg-red-500/30',
        state === 'completed' && 'bg-green-500/20',
      )}
      title={getStageTooltip(stage, data)}
      onClick={expandable ? onToggle : undefined}
    >
      <div className="flex items-center gap-1">
        <span className="text-lg">{icon}</span>
        {expandable &&
          (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
      </div>
      <span className="text-xs text-muted-foreground">{stage}</span>
    </div>
  )
}
