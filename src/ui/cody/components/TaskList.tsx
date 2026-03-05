/**
 * @fileType component
 * @domain cody
 * @pattern task-list
 * @ai-summary Rich task list with status indicators, assignee badges, PR links, and pipeline progress. Responsive for mobile.
 */
'use client'

import { useCallback } from 'react'
import { cn, formatRelativeTime, formatDuration } from '../utils'
import { getGitHubIssueUrl } from '../constants'
import { MergeButton } from './MergeButton'
import type { CodyTask, ColumnId } from '../types'
import { Button } from '@/ui/web/components/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/web/components/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/web/components/select'
import {
  GitPullRequest,
  ExternalLink,
  Play,
  Square,
  Bot,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  CircleDot,
  Siren,
  Clock,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react'

interface TaskListProps {
  tasks: CodyTask[]
  selectedTask?: CodyTask | null
  executingTaskId?: string | null
  mergingTaskId?: string | null
  onTaskSelect?: (task: CodyTask | null) => void
  onExecuteTask?: (taskId: string) => void
  onStopTask?: (task: CodyTask) => void
  onApproveReview?: (task: CodyTask) => Promise<void>
  onAssign?: (issueNumber: number, assignees: string[]) => void
  onUnassign?: (issueNumber: number, assignees: string[]) => void
  collaborators?: { login: string; avatar_url: string }[]
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
    icon: <CircleDot className="w-5 h-5 text-zinc-400" />,
    barColor: 'bg-zinc-400',
    label: 'Backlog',
  },
  building: {
    icon: <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />,
    barColor: 'bg-blue-500',
    label: 'Building',
  },
  review: {
    icon: <GitPullRequest className="w-5 h-5 text-purple-500" />,
    barColor: 'bg-purple-500',
    label: 'In Review',
  },
  failed: {
    icon: <XCircle className="w-5 h-5 text-red-500" />,
    barColor: 'bg-red-500',
    label: 'Failed',
  },
  'gate-waiting': {
    icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    barColor: 'bg-yellow-500',
    label: 'Gate',
  },
  retrying: {
    icon: <RotateCcw className="w-5 h-5 text-orange-500" />,
    barColor: 'bg-orange-500',
    label: 'Retrying',
  },
  done: {
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    barColor: 'bg-emerald-500',
    label: 'Done',
  },
}

export function TaskList({
  tasks,
  selectedTask,
  executingTaskId,
  mergingTaskId,
  onTaskSelect,
  onExecuteTask,
  onStopTask,
  onApproveReview,
  onAssign,
  onUnassign,
  collaborators = [],
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
      <div className="divide-y divide-border/50">
        {tasks.map((task) => {
          const indicator = statusIndicator[task.column]
          const isSelected = task.id === selectedTask?.id
          const isUnassigned = !task.assignees || task.assignees.length === 0
          const canExecute = isUnassigned && task.state === 'open' && onExecuteTask
          const isExecuting = executingTaskId === task.id
          const isMerging = mergingTaskId === task.id
          const hasPR = !!task.associatedPR
          const isHardStop = task.column === 'gate-waiting' && task.gateType === 'hard-stop'

          return (
            <div
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className={cn(
                'relative flex flex-col gap-2 px-4 py-3 cursor-pointer transition-all duration-150',
                'dark:hover:bg-zinc-800/50 hover:bg-zinc-100',
                rowTint[task.column],
                isSelected && 'dark:bg-zinc-800 bg-white',
                isHardStop && 'ring-2 ring-red-500/40 ring-inset',
              )}
            >
              {/* Left color bar - shows progress when running */}
              <div
                className={cn(
                  'absolute left-0 top-0 bottom-0 w-[3px] rounded-r',
                  isHardStop ? 'bg-red-500 animate-pulse' : indicator.barColor,
                )}
              >
                {/* Progress bar overlay when running */}
                {task.pipeline &&
                  task.pipeline.state === 'running' &&
                  task.pipeline.currentStage &&
                  task.pipeline.stages?.[task.pipeline.currentStage]?.elapsed &&
                  (() => {
                    const currentStage = task.pipeline.currentStage
                    const stageElapsed = (task.pipeline.stages[currentStage]?.elapsed || 0) * 1000
                    const stageMaxMs: Record<string, number> = {
                      taskify: 10 * 60 * 1000,
                      spec: 15 * 60 * 1000,
                      architect: 30 * 60 * 1000,
                      build: 45 * 60 * 1000,
                    }
                    const maxMs = stageMaxMs[currentStage] || 20 * 60 * 1000
                    const pct = Math.min(100, (stageElapsed / maxMs) * 100)
                    return (
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-blue-400/30 rounded-r transition-all duration-1000"
                        style={{ width: `${pct}%` }}
                      />
                    )
                  })()}
              </div>

              {/* Top row: Status icon + Title */}
              <div className="flex items-center gap-2 pl-2 sm:pl-5">
                <div className="shrink-0">{indicator.icon}</div>
                <h3 className="text-base font-medium dark:text-zinc-100 text-zinc-900 truncate flex-1">
                  {task.title}
                </h3>
              </div>

              {/* Bottom row */}
              <div className="flex items-center gap-2 pl-2 sm:pl-9">
                {/* Left side: Issue#, CODY, Status, Labels, Time */}
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  <a
                    href={getGitHubIssueUrl(task.issueNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View issue on GitHub"
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-mono font-medium dark:text-zinc-500 text-zinc-600 dark:hover:text-blue-400 hover:text-blue-600 shrink-0 w-10 hover:underline"
                  >
                    #{task.issueNumber}
                  </a>

                  {task.isCodyAssigned && (
                    <span
                      title="Assigned to Cody AI"
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-600 text-white text-xs font-bold"
                    >
                      <Bot className="w-3 h-3" />
                      CODY
                    </span>
                  )}

                  {/* Gate badges */}
                  {task.column === 'gate-waiting' && task.gateType === 'hard-stop' ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white text-xs font-bold">
                      <Siren className="w-3 h-3" />
                      HARD STOP
                    </span>
                  ) : task.column === 'gate-waiting' && task.gateType === 'risk-gated' ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-600 text-white text-xs font-bold">
                      <AlertCircle className="w-3 h-3" />
                      RISK GATED
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-medium px-2 py-1 rounded shrink-0 inline-flex items-center gap-1',
                        task.column === 'open' &&
                          'dark:text-zinc-400 dark:bg-zinc-800 text-zinc-600 bg-zinc-100',
                        task.column === 'building' && 'text-blue-400 bg-blue-500/20',
                        task.column === 'review' && 'text-purple-400 bg-purple-500/20',
                        task.column === 'failed' && 'text-red-400 bg-red-500/20',
                        task.column === 'gate-waiting' && 'text-yellow-400 bg-yellow-500/20',
                        task.column === 'retrying' && 'text-orange-400 bg-orange-500/20',
                        task.column === 'done' && 'text-emerald-400 bg-emerald-500/20',
                      )}
                    >
                      {task.column === 'gate-waiting' && <AlertTriangle className="w-3.5 h-3.5" />}
                      {indicator.label}
                    </span>
                  )}

                  {/* Rich pipeline progress */}
                  {task.pipeline && (
                    <span className="shrink-0 inline-flex items-center gap-1.5 text-xs">
                      {task.pipeline.state === 'running' && task.pipeline.currentStage && (
                        <>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-600 text-white font-medium">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {task.pipeline.currentStage}
                          </span>
                          {/* Show estimated progress based on typical stage durations */}
                          {task.pipeline.stages?.[task.pipeline.currentStage]?.elapsed &&
                            (() => {
                              const stageElapsed =
                                (task.pipeline.stages[task.pipeline.currentStage].elapsed || 0) *
                                1000
                              // Typical max durations in minutes
                              const stageMaxMs: Record<string, number> = {
                                taskify: 10 * 60 * 1000,
                                spec: 15 * 60 * 1000,
                                gap: 10 * 60 * 1000,
                                clarify: 10 * 60 * 1000,
                                architect: 30 * 60 * 1000,
                                'plan-gap': 10 * 60 * 1000,
                                build: 45 * 60 * 1000,
                                commit: 5 * 60 * 1000,
                                verify: 15 * 60 * 1000,
                                auditor: 15 * 60 * 1000,
                                pr: 5 * 60 * 1000,
                              }
                              const maxMs = stageMaxMs[task.pipeline.currentStage] || 20 * 60 * 1000
                              const pct = Math.min(99, Math.round((stageElapsed / maxMs) * 100))
                              return (
                                <span className="inline-flex items-center gap-1">
                                  <div className="w-14 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-400 rounded-full animate-pulse"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-blue-300 font-mono text-[10px]">
                                    {pct}%
                                  </span>
                                </span>
                              )
                            })()}
                          {/* Fallback: show total elapsed if no stage time */}
                          {!task.pipeline.stages?.[task.pipeline.currentStage]?.elapsed &&
                            task.pipeline.totalElapsed && (
                              <span className="text-blue-400 font-mono">
                                {formatDuration(task.pipeline.totalElapsed * 1000)}
                              </span>
                            )}
                        </>
                      )}
                      {task.pipeline.state !== 'running' &&
                        Object.keys(task.pipeline.stages || {}).length > 0 && (
                          <>
                            {/* Progress bar */}
                            {(() => {
                              const stages = task.pipeline.stages || {}
                              const total = Object.keys(stages).length
                              const completed = Object.values(stages).filter(
                                (s) => s.state === 'completed',
                              ).length
                              const pct = Math.round((completed / total) * 100)
                              return (
                                <span className="inline-flex items-center gap-1">
                                  <div className="w-12 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${task.pipeline.state === 'failed' ? 'bg-red-500' : 'bg-emerald-500'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-zinc-400">
                                    {completed}/{total}
                                  </span>
                                </span>
                              )
                            })()}
                            <span
                              className={`font-medium ${task.pipeline.state === 'completed' ? 'text-emerald-400' : task.pipeline.state === 'failed' ? 'text-red-400' : 'text-zinc-400'}`}
                            >
                              {task.pipeline.state === 'completed' && '✓ done'}
                              {task.pipeline.state === 'failed' && '✗ failed'}
                              {task.pipeline.state === 'timeout' && '⏰ timeout'}
                            </span>
                          </>
                        )}
                    </span>
                  )}

                  {/* Sub-status badges - show important states */}
                  {task.isTimeout && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-600 text-white text-xs font-bold">
                      <Clock className="w-3 h-3" />
                      TIMEOUT
                    </span>
                  )}
                  {task.isExhausted && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white text-xs font-bold">
                      <RefreshCw className="w-3 h-3" />
                      EXHAUSTED
                    </span>
                  )}
                  {task.isSupervisorError && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white text-xs font-bold">
                      <AlertCircle className="w-3 h-3" />
                      ERROR
                    </span>
                  )}
                  {task.clarifyWaiting && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-bold">
                      <AlertCircle className="w-3 h-3" />
                      NEEDS ANSWER
                    </span>
                  )}

                  {task.labels.length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded dark:bg-zinc-700 dark:text-zinc-300 bg-zinc-200 text-zinc-700 truncate max-w-24">
                      {task.labels[0]}
                    </span>
                  )}

                  {/* Assignees */}
                  {task.assignees && task.assignees.length > 0 && (
                    <div className="flex items-center gap-1">
                      {task.assignees.map((assignee) => (
                        <Avatar key={assignee.login} className="h-5 w-5" title={assignee.login}>
                          <AvatarImage src={assignee.avatar_url} alt={assignee.login} />
                          <AvatarFallback className="text-[8px]">
                            {assignee.login[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {onUnassign && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onUnassign(
                              task.issueNumber,
                              task.assignees!.map((a) => a.login),
                            )
                          }}
                          className="ml-1 p-0.5 rounded-full hover:bg-zinc-600/50 text-zinc-400 hover:text-zinc-200"
                          title="Unassign all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  <span className="text-xs text-zinc-500 dark:text-zinc-500 text-zinc-400 shrink-0">
                    {formatRelativeTime(task.updatedAt)}
                  </span>
                </div>

                {/* Right side: PR, Preview, Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {hasPR && (
                    <a
                      href={task.associatedPR!.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open PR in GitHub"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-sm dark:text-purple-400 dark:hover:text-purple-300 text-purple-700 hover:text-purple-800"
                    >
                      <GitPullRequest className="w-4 h-4" />
                    </a>
                  )}

                  {task.previewUrl && (
                    <a
                      href={task.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:underline shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  {/* Assignee Picker */}
                  {onAssign && collaborators.length > 0 && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="relative"
                    >
                      <Select
                        onValueChange={(value) => {
                          onAssign(task.issueNumber, [value])
                        }}
                      >
                        <SelectTrigger className="h-7 w-auto px-2 text-xs gap-1">
                          <SelectValue placeholder="Assign" />
                        </SelectTrigger>
                        <SelectContent>
                          {collaborators
                            .filter((c) => !task.assignees?.some((a) => a.login === c.login))
                            .map((collaborator) => (
                              <SelectItem
                                key={collaborator.login}
                                value={collaborator.login}
                                className="flex items-center gap-2"
                              >
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={collaborator.avatar_url} />
                                  <AvatarFallback className="text-[8px]">
                                    {collaborator.login[0]?.toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                {collaborator.login}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {task.column === 'review' && hasPR && onApproveReview && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <MergeButton
                        prNumber={task.associatedPR!.number}
                        prTitle={task.associatedPR!.title}
                        branchName={task.associatedPR!.head.ref}
                        isMerging={isMerging}
                        onMerge={() => onApproveReview(task)}
                      />
                    </div>
                  )}
                  {/* Run/Stop toggle - only show stop if there's a running workflow */}
                  {(task.column === 'building' &&
                    task.workflowRun?.status === 'in_progress' &&
                    onStopTask) ||
                  (canExecute && onExecuteTask) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isExecuting}
                      title={
                        task.column === 'building' ? 'Stop running task' : 'Start running this task'
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        if (task.column === 'building') {
                          onStopTask?.(task)
                        } else if (canExecute) {
                          onExecuteTask?.(task.id)
                        }
                      }}
                      className={cn(
                        'h-7 text-sm px-2 gap-1 cursor-pointer disabled:opacity-50',
                        task.column === 'building'
                          ? 'text-red-400 bg-red-500/10 hover:bg-red-500/30 hover:border-red-500/50 hover:shadow-lg'
                          : 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/30 hover:border-blue-500/50 hover:shadow-lg',
                      )}
                    >
                      {isExecuting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : task.column === 'building' ? (
                        <Square className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
