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
import { Button } from '@/ui/web/components/button'
import {
  GitPullRequest,
  ExternalLink,
  Play,
  Bot,
  Loader2,
  CheckCircle2,
  XCircle,
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
      <div className="divide-y divide-border/50">
        {tasks.map((task) => {
          const indicator = statusIndicator[task.column]
          const isSelected = task.id === selectedTask?.id
          const isUnassigned = !task.assignees || task.assignees.length === 0
          const canExecute = isUnassigned && task.state === 'open' && onExecuteTask
          const hasPR = !!task.associatedPR
          const isHardStop = task.column === 'gate-waiting' && task.gateType === 'hard-stop'

          return (
            <div
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className={cn(
                'relative flex flex-col gap-2 px-4 py-3 cursor-pointer transition-all duration-150',
                'hover:bg-zinc-800/50',
                rowTint[task.column],
                isSelected && 'bg-zinc-800',
                isHardStop && 'ring-2 ring-red-500/40 ring-inset',
              )}
            >
              {/* Left color bar */}
              <div
                className={cn(
                  'absolute left-0 top-0 bottom-0 w-[3px] rounded-r',
                  isHardStop ? 'bg-red-500 animate-pulse' : indicator.barColor,
                )}
              />

              {/* Top row: Status icon + Title */}
              <div className="flex items-center gap-2 ml-5">
                <div className="shrink-0">{indicator.icon}</div>
                <h3 className="text-base font-medium text-zinc-100 truncate flex-1">
                  {task.title}
                </h3>
              </div>

              {/* Bottom row */}
              <div className="flex items-center gap-2 ml-9">
                {/* Left side: Issue number, CODY, Status, Labels */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-mono font-medium text-zinc-500 shrink-0 w-10">
                    #{task.issueNumber}
                  </span>

                  {task.isCodyAssigned && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-600 text-white text-xs font-bold">
                      <Bot className="w-3 h-3" />
                      CODY
                    </span>
                  )}

                  {task.column === 'gate-waiting' && task.gateType === 'hard-stop' ? (
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-600 text-white text-xs font-bold">
                      <Siren className="w-3.5 h-3.5" />
                      HARD STOP
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-medium px-2 py-1 rounded shrink-0 inline-flex items-center gap-1',
                        task.column === 'open' && 'text-zinc-400 bg-zinc-800',
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

                  {task.labels.length > 0 && (
                    <span className="text-xs text-zinc-500 truncate max-w-24">
                      {task.labels[0]}
                    </span>
                  )}
                </div>

                {/* Spacer pushes right side to the right */}
                <div className="flex-1" />

                {/* Right side: PR, Preview, Time, Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {hasPR && (
                    <a
                      href={task.associatedPR!.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300"
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
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </a>
                  )}

                  <span className="text-xs text-zinc-500 shrink-0">
                    {formatRelativeTime(task.updatedAt)}
                  </span>

                  {task.column === 'review' && hasPR && onApproveReview && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onApproveReview(task)
                      }}
                      className="h-7 text-sm px-3 gap-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <GitPullRequest className="w-4 h-4" />
                      <span className="hidden sm:inline">Merge</span>
                    </Button>
                  )}

                  {canExecute && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onExecuteTask(task.id)
                      }}
                      className="h-7 text-sm px-3 gap-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
