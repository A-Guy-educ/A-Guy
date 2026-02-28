/**
 * @fileType component
 * @domain cody
 * @pattern task-list
 * @ai-summary Rich task list with status indicators, assignee badges, PR links, and pipeline progress. Responsive for mobile.
 */
'use client'

import { useCallback } from 'react'
import { cn, formatRelativeTime } from '../utils'
import type { CodyTask, ColumnId } from '../types'
import { ALL_STAGES } from '../constants'
import { Button } from '@/ui/web/components/button'
import {
  GitPullRequest,
  ExternalLink,
  Play,
  Bot,
  User,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  CircleDot,
  Siren,
} from 'lucide-react'

interface TaskListProps {
  tasks: CodyTask[]
  selectedTask?: CodyTask | null
  onTaskSelect?: (task: CodyTask | null) => void
  onExecuteTask?: (taskId: string) => void
  onApproveReview?: (task: CodyTask) => void
}

// Row background tint by status
const rowTint: Record<ColumnId, string> = {
  open: '',
  building: 'bg-blue-500/[0.03]',
  review: 'bg-purple-500/[0.03]',
  failed: 'bg-red-500/[0.04]',
  'gate-waiting': 'bg-yellow-500/[0.03]',
  retrying: 'bg-orange-500/[0.03]',
  done: 'bg-emerald-500/[0.03]',
}

// Status indicator — left colored bar + icon
const statusIndicator: Record<
  ColumnId,
  { icon: React.ReactNode; barColor: string; label: string }
> = {
  open: {
    icon: <CircleDot className="w-3.5 h-3.5 text-muted-foreground" />,
    barColor: 'bg-muted-foreground/30',
    label: 'Backlog',
  },
  building: {
    icon: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
    barColor: 'bg-blue-500',
    label: 'Building',
  },
  review: {
    icon: <GitPullRequest className="w-3.5 h-3.5 text-purple-400" />,
    barColor: 'bg-purple-500',
    label: 'In Review',
  },
  failed: {
    icon: <XCircle className="w-3.5 h-3.5 text-red-400" />,
    barColor: 'bg-red-500',
    label: 'Failed',
  },
  'gate-waiting': {
    icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />,
    barColor: 'bg-yellow-500',
    label: 'Gate',
  },
  retrying: {
    icon: <RotateCcw className="w-3.5 h-3.5 text-orange-400" />,
    barColor: 'bg-orange-500',
    label: 'Retrying',
  },
  done: {
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    barColor: 'bg-emerald-500',
    label: 'Done',
  },
}

// Pipeline stage labels for tooltip
const stageLabels: Record<string, string> = {
  taskify: 'Analyze',
  spec: 'Spec',
  clarify: 'Clarify',
  architect: 'Architect',
  'plan-review': 'Plan',
  build: 'Build',
  commit: 'Commit',
  verify: 'Verify',
  auditor: 'Audit',
  'apply-audit': 'Fix',
  pr: 'PR',
  autofix: 'Autofix',
}

export function TaskList({
  tasks,
  selectedTask,
  onTaskSelect,
  onExecuteTask,
  onApproveReview,
}: TaskListProps) {
  const handleTaskClick = useCallback(
    (task: CodyTask) => {
      if (onTaskSelect) {
        onTaskSelect(selectedTask?.id === task.id ? null : task)
      }
    },
    [onTaskSelect, selectedTask],
  )

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No tasks found</p>
      </div>
    )
  }

  return (
    <div>
      <div className="divide-y divide-border">
        {tasks.map((task) => {
          const indicator = statusIndicator[task.column]
          const isSelected = task.id === selectedTask?.id
          const isUnassigned = !task.assignees || task.assignees.length === 0
          const canExecute = isUnassigned && task.state === 'open' && onExecuteTask
          const hasPR = !!task.associatedPR
          const isActive = task.column === 'building' || task.column === 'retrying'
          const pipelineStage = task.pipeline?.currentStage
          const pipelineStageIdx = pipelineStage
            ? ALL_STAGES.indexOf(pipelineStage as (typeof ALL_STAGES)[number])
            : -1

          // Determine if this is a hard-stop gate (always show prominently)
          const isHardStop = task.column === 'gate-waiting' && task.gateType === 'hard-stop'

          return (
            <div
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className={cn(
                'relative flex items-start gap-2 md:gap-3 px-4 md:px-6 py-3 cursor-pointer transition-colors',
                'hover:bg-accent/50',
                rowTint[task.column],
                isSelected && 'bg-accent',
                // Hard stop gets a pulsing red border
                isHardStop && 'ring-2 ring-red-500/50 ring-inset',
              )}
            >
              {/* Left color bar */}
              <div
                className={cn(
                  'absolute left-0 top-0 bottom-0 w-[3px] rounded-r',
                  isHardStop ? 'bg-red-500 animate-pulse' : indicator.barColor,
                )}
              />

              {/* Status icon */}
              <div className="shrink-0 mt-0.5">{indicator.icon}</div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                {/* Row 1: Title line - show CODY badge prominently right after status icon */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    #{task.issueNumber}
                  </span>

                  {/* CODY badge - VERY PROMINENT - right after issue number */}
                  {task.isCodyAssigned && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-bold shadow-sm">
                      <Bot className="w-3 h-3" />
                      CODY
                    </span>
                  )}

                  <h3 className="text-sm font-medium text-foreground truncate">{task.title}</h3>
                </div>

                {/* Row 2: Meta indicators - HARD STOP gets special treatment */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                  {/* HARD STOP indicator - EXTRA PROMINENT */}
                  {task.column === 'gate-waiting' && task.gateType === 'hard-stop' ? (
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white text-[12px] font-bold shadow-sm animate-pulse">
                      <Siren className="w-4 h-4" />
                      🚫 HARD STOP - APPROVAL NEEDED
                    </span>
                  ) : (
                    /* Normal status label */
                    <span
                      className={cn(
                        'text-[11px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-1',
                        // Default column styling
                        task.column === 'open' && 'text-muted-foreground bg-muted/50',
                        task.column === 'building' && 'text-blue-400 bg-blue-500/10',
                        task.column === 'review' && 'text-purple-400 bg-purple-500/10',
                        // Gate substatus overrides
                        task.column === 'gate-waiting' &&
                          task.gateType === 'risk-gated' &&
                          'text-yellow-400 bg-yellow-500/20 border border-yellow-500/30',
                        task.column === 'gate-waiting' &&
                          !task.gateType &&
                          'text-yellow-400 bg-yellow-500/20 border border-yellow-500/30',
                        // Failed substatus overrides
                        task.column === 'failed' &&
                          task.isTimeout &&
                          'text-orange-400 bg-orange-500/10',
                        task.column === 'failed' &&
                          task.isExhausted &&
                          'text-red-500 bg-red-600/10',
                        task.column === 'failed' &&
                          task.isSupervisorError &&
                          'text-red-400 bg-red-500/10',
                        task.column === 'failed' &&
                          !task.isTimeout &&
                          !task.isExhausted &&
                          !task.isSupervisorError &&
                          'text-red-400 bg-red-500/10',
                        // Other columns
                        task.column === 'retrying' && 'text-orange-400 bg-orange-500/10',
                        task.column === 'done' && 'text-emerald-400 bg-emerald-500/10',
                      )}
                    >
                      {task.column === 'gate-waiting' && <AlertTriangle className="w-3 h-3" />}
                      {task.column === 'gate-waiting' && task.gateType === 'risk-gated'
                        ? `🚦 Review${task.gateStage ? ` · ${task.gateStage}` : ''}`
                        : task.column === 'gate-waiting'
                          ? `⚠️ Gate`
                          : task.column === 'failed' && task.isTimeout
                            ? '⏰ Timeout'
                            : task.column === 'failed' && task.isExhausted
                              ? 'Exhausted'
                              : task.column === 'failed' && task.isSupervisorError
                                ? 'System Error'
                                : indicator.label}
                    </span>
                  )}

                  {/* Clarify-waiting indicator */}
                  {task.clarifyWaiting && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded text-amber-400 bg-amber-500/10">
                      💬 Needs Answer
                    </span>
                  )}

                  {/* Assignee indicator - only for human assignees */}
                  {task.assignees && task.assignees.length > 0 && !task.isCodyAssigned ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span className="hidden sm:inline">
                        {task.assignees.map((a) => a.login).join(', ')}
                      </span>
                    </span>
                  ) : null}

                  {/* PR link */}
                  {hasPR && (
                    <a
                      href={task.associatedPR!.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 hover:underline"
                    >
                      <GitPullRequest className="w-3 h-3" />
                      <span className="hidden sm:inline">PR</span> #{task.associatedPR!.number}
                    </a>
                  )}

                  {/* Vercel preview link */}
                  {task.previewUrl && (
                    <a
                      href={task.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="hidden sm:inline">Preview</span>
                    </a>
                  )}

                  {/* Workflow run indicator */}
                  {task.workflowRun && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-[11px]',
                        task.workflowRun.status === 'in_progress' && 'text-blue-400',
                        task.workflowRun.status === 'completed' &&
                          task.workflowRun.conclusion === 'success' &&
                          'text-emerald-400',
                        task.workflowRun.status === 'completed' &&
                          task.workflowRun.conclusion === 'failure' &&
                          'text-red-400',
                        task.workflowRun.status === 'completed' &&
                          task.workflowRun.conclusion === 'timed_out' &&
                          'text-orange-400',
                        task.workflowRun.status === 'completed' &&
                          task.workflowRun.conclusion === 'cancelled' &&
                          'text-muted-foreground',
                      )}
                    >
                      {task.workflowRun.status === 'in_progress' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : task.workflowRun.conclusion === 'success' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      <span className="hidden sm:inline">Run</span>
                    </span>
                  )}

                  {/* Labels - hidden on mobile */}
                  {task.labels.length > 0 && (
                    <span className="hidden sm:contents">
                      <span className="text-border">·</span>
                      {task.labels.slice(0, 2).map((label) => (
                        <span
                          key={label}
                          className="text-[11px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded"
                        >
                          {label}
                        </span>
                      ))}
                      {task.labels.length > 2 && (
                        <span className="text-[11px] text-muted-foreground">
                          +{task.labels.length - 2}
                        </span>
                      )}
                    </span>
                  )}

                  {/* Mobile timestamp */}
                  <span className="inline-flex sm:hidden items-center gap-1 text-[11px] text-muted-foreground ml-auto">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(task.updatedAt)}
                  </span>
                </div>

                {/* Row 3: Pipeline progress bar */}
                {isActive && pipelineStageIdx >= 0 && (
                  <div className="flex items-center gap-0.5 mt-1.5">
                    {ALL_STAGES.map((stage, i) => (
                      <div
                        key={stage}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-all',
                          i < pipelineStageIdx && 'bg-blue-500',
                          i === pipelineStageIdx && 'bg-blue-500 animate-pulse',
                          i > pipelineStageIdx && 'bg-muted',
                        )}
                        title={stageLabels[stage] || stage}
                      />
                    ))}
                    <span className="ml-1.5 text-[10px] text-blue-400 shrink-0">
                      {stageLabels[pipelineStage!] || pipelineStage}
                    </span>
                  </div>
                )}
              </div>

              {/* Right side: time + action - desktop only */}
              <div className="hidden sm:flex items-center gap-2 shrink-0 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(task.updatedAt)}
                </span>

                {/* Merge button - for In Review items with PR */}
                {task.column === 'review' && hasPR && onApproveReview && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onApproveReview(task)
                    }}
                    className="h-6 text-xs px-2 gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300"
                  >
                    <GitPullRequest className="w-3 h-3" />
                    Merge
                  </Button>
                )}

                {canExecute && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onExecuteTask(task.id)
                    }}
                    className="h-6 text-xs px-2 gap-1 text-blue-400 border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-300"
                  >
                    <Play className="w-3 h-3" />
                    Run
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
