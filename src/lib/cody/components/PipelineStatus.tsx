/**
 * @fileType component
 * @domain cody
 * @pattern pipeline-status
 * @ai-summary Pipeline status visualization
 */
'use client'

import { cn, formatDuration } from '../utils'
import type { CodyPipelineStatus, StageStatus } from '../types'
import { SPEC_STAGES, IMPL_STAGES } from '../constants'

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
  timeout: '⏰',
}

export function PipelineStatus({ status, className }: PipelineStatusProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Spec Pipeline */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Spec Pipeline</h3>
        <div className="flex items-center gap-1 flex-wrap">
          {SPEC_STAGES.map((stage, index) => {
            const stageData = status.stages[stage]
            return (
              <div key={stage} className="flex items-center">
                <StageIndicator stage={stage} data={stageData} />
                {index < SPEC_STAGES.length - 1 && <span className="mx-1 text-gray-600">→</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Implementation Pipeline */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Implementation Pipeline
        </h3>
        <div className="flex items-center gap-1 flex-wrap">
          {IMPL_STAGES.map((stage, index) => {
            const stageData = status.stages[stage]
            return (
              <div key={stage} className="flex items-center">
                <StageIndicator stage={stage} data={stageData} />
                {index < IMPL_STAGES.length - 1 && <span className="mx-1 text-gray-600">→</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Current Stage */}
      {status.currentStage && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Current:</span>
          <span className="text-white font-medium">{status.currentStage}</span>
        </div>
      )}
    </div>
  )
}

interface StageIndicatorProps {
  stage: string
  data?: StageStatus
}

function StageIndicator({ stage, data }: StageIndicatorProps) {
  const state = data?.state || 'pending'
  const icon = stageIcons[state] || '⏳'
  const elapsed = data?.elapsed

  return (
    <div
      className={cn(
        'flex flex-col items-center px-2 py-1 rounded',
        state === 'running' && 'bg-blue-500/20',
        state === 'failed' && 'bg-red-500/20',
        state === 'completed' && 'bg-green-500/20',
      )}
      title={`${stage}: ${state}${elapsed ? ` (${formatDuration(elapsed)})` : ''}`}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs text-gray-400">{stage}</span>
    </div>
  )
}
