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
} from 'lucide-react'

interface TaskListProps {
  tasks: CodyTask[]
  selectedTask?: CodyTask | null
  onTaskSelect?: (task: CodyTask | null) => void
  onExecuteTask?: (taskId: string) => void
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

export function TaskList({ tasks, selectedTask, onTaskSelect, onExecuteTask }: TaskListProps) {
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

          return (
            <div
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className={cn(
                'relative flex items-start gap-2 md:gap-3 px-4 md:px-6 py-3 cursor-pointer transition-colors',
                'hover:bg-accent/50',
                rowTint[task.column],
                isSelected && 'bg-accent',
              )}
            >
              {/* Left color bar */}
              <div
                className={cn(
                  'absolute left-0 top-0 bottom-0 w-[3px] rounded-r',
                  indicator.barColor,
                )}
              />

              {/* Status icon */}
              <div className="shrink-0 mt-0.5">{indicator.icon}</div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                {/* Row 1: Title line */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    #{task.issueNumber}
                  </span>
                  <h3 className="text-sm font-medium text-foreground truncate">{task.title}</h3>
                </div>

                {/* Row 2: Meta indicators */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                  {/* Status label */}
                  <span
                    className={cn(
                      'text-[11px] font-medium px-1.5 py-0.5 rounded',
                      task.column === 'open' && 'text-muted-foreground bg-muted/50',
                      task.column === 'building' && 'text-blue-400 bg-blue-500/10',
                      task.column === 'review' && 'text-purple-400 bg-purple-500/10',
                      task.column === 'failed' && 'text-red-400 bg-red-500/10',
                      task.column === 'gate-waiting' && 'text-yellow-400 bg-yellow-500/10',
                      task.column === 'retrying' && 'text-orange-400 bg-orange-500/10',
                      task.column === 'done' && 'text-emerald-400 bg-emerald-500/10',
                    )}
                  >
                    {indicator.label}
                  </span>

                  {/* Assignee indicator */}
                  {task.isCodyAssigned ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-blue-400">
                      <Bot className="w-3 h-3" />
                      Cody
                    </span>
                  ) : task.assignees && task.assignees.length > 0 ? (
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

                  {/* Labels — hidden on mobile, shown on sm+ */}
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

                  {/* Mobile-only: timestamp inline */}
                  <span className="inline-flex sm:hidden items-center gap-1 text-[11px] text-muted-foreground ml-auto">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(task.updatedAt)}
                  </span>
                </div>

                {/* Row 3: Pipeline progress bar (only when building/retrying) */}
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

              {/* Right side: time + action — desktop only */}
              <div className="hidden sm:flex items-center gap-2 shrink-0 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(task.updatedAt)}
                </span>

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
