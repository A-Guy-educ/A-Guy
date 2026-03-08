/**
 * @fileType component
 * @domain cody
 * @pattern cody-status-banner
 * @ai-summary Banner showing Cody's current state: idle, working, failed, or gate-waiting
 */
'use client'

import { useState, useEffect } from 'react'
import { cn, formatRelativeTime } from '../utils'
import { stageLabels, formatElapsed, getStageProgressTooltip } from '../pipeline-utils'
import type { CodyTask } from '../types'
import { ALL_STAGES, getGitHubIssueUrl } from '../constants'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/ui/web/components/badge'
import { Button } from '@/ui/web/components/button'

interface CodyStatusBannerProps {
  tasks: CodyTask[]
  onAbort?: (taskId: string) => void
  /** Whether a background refetch is in progress */
  isFetching?: boolean
  /** Timestamp (ms) of last successful data update */
  dataUpdatedAt?: number
}

type CodyState =
  | { status: 'idle'; taskCount: number }
  | { status: 'working'; task: CodyTask; stage: string | null; elapsed: string }
  | { status: 'failed'; task: CodyTask; failedAgo: string }
  | { status: 'gate-waiting'; task: CodyTask }

function deriveCodyState(tasks: CodyTask[]): CodyState {
  // Priority: working > gate-waiting > failed > idle

  const working = tasks.find((t) => t.column === 'building' || t.column === 'retrying')
  if (working) {
    const pipeline = working.pipeline
    const elapsed = pipeline?.startedAt
      ? formatElapsed(new Date(pipeline.startedAt))
      : formatRelativeTime(working.updatedAt)

    // Derive current stage: use currentStage if available, otherwise infer from stages data
    let stage = pipeline?.currentStage ?? null
    if (!stage && pipeline?.stages) {
      // Find the highest stage that has been touched
      for (const [stageName, stageData] of Object.entries(pipeline.stages)) {
        if (stageData.state !== 'pending') {
          const idx = ALL_STAGES.indexOf(stageName as (typeof ALL_STAGES)[number])
          const prevIdx = stage ? ALL_STAGES.indexOf(stage as (typeof ALL_STAGES)[number]) : -1
          if (idx > prevIdx) stage = stageName
        }
      }
    }

    return {
      status: 'working',
      task: working,
      stage,
      elapsed,
    }
  }

  const gateWaiting = tasks.find((t) => t.column === 'gate-waiting')
  if (gateWaiting) {
    return { status: 'gate-waiting', task: gateWaiting }
  }

  const failed = tasks.find((t) => t.column === 'failed')
  if (failed) {
    return { status: 'failed', task: failed, failedAgo: formatRelativeTime(failed.updatedAt) }
  }

  return { status: 'idle', taskCount: tasks.length }
}

/** Subtle refresh indicator — shows spinner when fetching, "Updated Xs ago" otherwise */
function RefreshIndicator({
  isFetching,
  dataUpdatedAt,
}: {
  isFetching?: boolean
  dataUpdatedAt?: number
}) {
  const [, setTick] = useState(0)

  // Tick every 15s to keep "Updated X ago" fresh
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15_000)
    return () => clearInterval(interval)
  }, [])

  if (!dataUpdatedAt) return null

  const ago = formatElapsed(new Date(dataUpdatedAt))

  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 ml-auto shrink-0">
      {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
      <span className="hidden sm:inline">{ago} ago</span>
    </span>
  )
}

export function CodyStatusBanner({
  tasks,
  onAbort,
  isFetching,
  dataUpdatedAt,
}: CodyStatusBannerProps) {
  const state = deriveCodyState(tasks)

  if (state.status === 'idle') {
    return (
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-muted/30">
        <span className="relative flex h-2.5 w-2.5">
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <span className="text-sm text-muted-foreground">
          Cody is <span className="text-foreground font-medium">idle</span> — {state.taskCount} open
          issues in backlog
        </span>
        <RefreshIndicator isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
      </div>
    )
  }

  if (state.status === 'working') {
    const currentStageIdx = state.stage
      ? ALL_STAGES.indexOf(state.stage as (typeof ALL_STAGES)[number])
      : -1

    return (
      <div className="px-6 py-4 border-b border-border bg-blue-500/5">
        {/* Top row: status + issue info */}
        <div className="flex items-center gap-3 mb-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
          </span>
          <span className="text-sm">
            <span className="text-foreground font-medium">Working on</span>{' '}
            <a
              href={getGitHubIssueUrl(state.task.issueNumber)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-400 hover:underline font-mono"
              title={`View issue #${state.task.issueNumber} on GitHub`}
            >
              #{state.task.issueNumber}
            </a>{' '}
            <span className="text-muted-foreground truncate">— {state.task.title}</span>
          </span>
          <RefreshIndicator isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
          <span className="text-xs text-muted-foreground font-mono" title="Elapsed time">
            {state.elapsed}
          </span>
          {onAbort && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAbort(state.task.id)}
              className="h-6 text-xs text-muted-foreground hover:text-destructive"
              title="Abort this task and stop the pipeline"
            >
              Abort
            </Button>
          )}
        </div>

        {/* Pipeline stages */}
        <div className="flex items-center gap-1">
          {ALL_STAGES.map((stage, i) => {
            const isCompleted = currentStageIdx > i
            const isCurrent = currentStageIdx === i
            const isPending = currentStageIdx < i
            const isPaused = isCurrent && state.task.pipeline?.state === 'paused'

            return (
              <div key={stage} className="flex items-center gap-1 flex-1">
                <div
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-all duration-300',
                    isCompleted && 'bg-blue-500',
                    isCurrent && !isPaused && 'bg-blue-500 animate-pulse',
                    isPaused && 'bg-yellow-500',
                    isPending && 'bg-muted',
                  )}
                  title={getStageProgressTooltip(
                    stage,
                    i,
                    currentStageIdx,
                    state.task.pipeline?.state,
                  )}
                />
              </div>
            )
          })}
        </div>
        {state.stage && (
          <div className="mt-1.5 text-xs text-muted-foreground">
            Stage:{' '}
            <span className="text-foreground">{stageLabels[state.stage] || state.stage}</span>
            {state.task.pipeline?.state === 'paused' && (
              <span className="ml-2 text-yellow-400 font-medium">⏸ Awaiting approval</span>
            )}
          </div>
        )}
      </div>
    )
  }

  if (state.status === 'gate-waiting') {
    return (
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-yellow-500/5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500" />
        </span>
        <span className="text-sm">
          <span className="text-yellow-400 font-medium">Waiting for approval</span> on{' '}
          <a
            href={getGitHubIssueUrl(state.task.issueNumber)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-yellow-400 hover:underline font-mono"
            title={`View issue #${state.task.issueNumber} on GitHub`}
          >
            #{state.task.issueNumber}
          </a>{' '}
          <span className="text-muted-foreground">— {state.task.title}</span>
        </span>
        <RefreshIndicator isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
        <Badge
          variant="outline"
          className="text-yellow-400 border-yellow-500/30"
          title="This task is waiting for approval before continuing"
        >
          Gate
        </Badge>
      </div>
    )
  }

  // failed
  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-destructive/5">
      <span className="relative flex h-2.5 w-2.5">
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
      <span className="text-sm">
        <span className="text-red-400 font-medium">Failed</span> on{' '}
        <a
          href={getGitHubIssueUrl(state.task.issueNumber)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-red-400 hover:underline font-mono"
          title={`View issue #${state.task.issueNumber} on GitHub`}
        >
          #{state.task.issueNumber}
        </a>{' '}
        <span className="text-muted-foreground">— {state.task.title}</span>
      </span>
      <RefreshIndicator isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
      <span className="text-xs text-muted-foreground" title="Failed at">
        {state.failedAgo}
      </span>
    </div>
  )
}
