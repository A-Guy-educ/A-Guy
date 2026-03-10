/**
 * @fileType component
 * @domain cody
 * @pattern task-list
 * @ai-summary Three-zone task list: color bar | title + inline metadata + assignees | actions. Pipeline progress gets its own row only when active.
 */
'use client'

import { useCallback } from 'react'
import { cn, formatRelativeTime } from '../utils'
import { getGitHubIssueUrl } from '../constants'
import { MergeButton } from './MergeButton'
import { MiniPipelineProgress } from './MiniPipelineProgress'
import { SimpleTooltip } from './SimpleTooltip'
import { StatusTooltipContent, SubStatusTooltipContent } from './tooltip-content'
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
  Clock,
  AlertCircle,
  RefreshCw,
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
  onTaskHover?: (task: CodyTask) => void
  onAssign?: (issueNumber: number, assignees: string[]) => void
  onUnassign?: (issueNumber: number, assignees: string[]) => void
  collaborators?: { login: string; avatar_url: string }[]
}

// ── Status colors — single source of truth ──
const statusColors: Record<ColumnId, { dot: string; text: string; bg: string; border: string }> = {
  open: { dot: 'bg-zinc-500', text: 'text-zinc-400', bg: '', border: '' },
  building: {
    dot: 'bg-blue-500',
    text: 'text-blue-400',
    bg: 'bg-blue-500/[0.04]',
    border: 'border-l-blue-500/50',
  },
  review: {
    dot: 'bg-purple-500',
    text: 'text-purple-400',
    bg: 'bg-purple-500/[0.04]',
    border: 'border-l-purple-500/50',
  },
  failed: {
    dot: 'bg-red-500',
    text: 'text-red-400',
    bg: 'bg-red-500/[0.05]',
    border: 'border-l-red-500/50',
  },
  'gate-waiting': {
    dot: 'bg-amber-500',
    text: 'text-amber-400',
    bg: 'bg-amber-500/[0.04]',
    border: 'border-l-amber-500/50',
  },
  retrying: {
    dot: 'bg-orange-500',
    text: 'text-orange-400',
    bg: 'bg-orange-500/[0.04]',
    border: 'border-l-orange-500/50',
  },
  done: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/[0.03]',
    border: 'border-l-emerald-500/50',
  },
}

// ── Status icon ──
const statusIcon: Record<ColumnId, React.ReactNode> = {
  open: <CircleDot className="w-[18px] h-[18px] text-zinc-500" />,
  building: <Loader2 className="w-[18px] h-[18px] text-blue-400 animate-spin" />,
  review: <GitPullRequest className="w-[18px] h-[18px] text-purple-400" />,
  failed: <XCircle className="w-[18px] h-[18px] text-red-400" />,
  'gate-waiting': <AlertTriangle className="w-[18px] h-[18px] text-amber-400" />,
  retrying: <RotateCcw className="w-[18px] h-[18px] text-orange-400" />,
  done: <CheckCircle2 className="w-[18px] h-[18px] text-emerald-400" />,
}

// ── Status label text ──
const statusLabel: Record<ColumnId, string> = {
  open: 'Backlog',
  building: 'Building',
  review: 'In Review',
  failed: 'Failed',
  'gate-waiting': 'Gate',
  retrying: 'Retrying',
  done: 'Done',
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
  onTaskHover,
  onAssign,
  onUnassign: _onUnassign,
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
    <div className="divide-y divide-white/[0.06]">
      {tasks.map((task) => {
        const isSelected = task.id === selectedTask?.id
        const canExecute = task.state === 'open' && onExecuteTask
        const isExecuting = executingTaskId === task.id
        const isMerging = mergingTaskId === task.id
        const hasPR = !!task.associatedPR
        const isHardStop = task.column === 'gate-waiting' && task.gateType === 'hard-stop'
        const isActive = task.column === 'building' || task.column === 'retrying'
        const colors = statusColors[task.column]
        const gateLabel =
          task.column === 'gate-waiting' && task.gateType === 'hard-stop'
            ? 'Hard Stop'
            : task.column === 'gate-waiting' && task.gateType === 'risk-gated'
              ? 'Risk Gated'
              : statusLabel[task.column]

        return (
          <div
            key={task.id}
            onClick={() => handleTaskClick(task)}
            onMouseEnter={() => onTaskHover?.(task)}
            className={cn(
              'group relative cursor-pointer transition-colors duration-100 border-l-2 border-l-transparent',
              'hover:bg-white/[0.04]',
              colors.bg,
              isSelected && cn('bg-white/[0.06] border-l-2', colors.border),
              isHardStop && 'ring-1 ring-red-500/30 ring-inset',
              task.column === 'done' && !isSelected && 'opacity-50 hover:opacity-80',
            )}
          >
            {/* Main row */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Status icon */}
              <div className="shrink-0">{statusIcon[task.column]}</div>

              {/* Content — title + meta */}
              <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[15px] font-medium text-zinc-100 truncate flex-1">
                    {task.title}
                  </h3>

                  {/* Assignee avatars */}
                  {task.assignees && task.assignees.length > 0 && (
                    <div className="hidden sm:flex items-center -space-x-1.5 shrink-0">
                      {task.assignees.map((assignee) => (
                        <SimpleTooltip key={assignee.login} content={assignee.login} side="bottom">
                          <span className="inline-block">
                            <Avatar className="h-5 w-5 ring-2 ring-[#0d1117]">
                              <AvatarImage src={assignee.avatar_url} alt={assignee.login} />
                              <AvatarFallback className="text-[8px] bg-zinc-800 text-zinc-400">
                                {assignee.login[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </span>
                        </SimpleTooltip>
                      ))}
                    </div>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                  <SimpleTooltip content="View issue on GitHub" side="bottom">
                    <a
                      href={getGitHubIssueUrl(task.issueNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={cn('font-mono font-semibold hover:underline', colors.text)}
                    >
                      #{task.issueNumber}
                    </a>
                  </SimpleTooltip>

                  <SimpleTooltip
                    content={<StatusTooltipContent column={task.column} gateType={task.gateType} />}
                    side="bottom"
                  >
                    <span className={cn('font-medium cursor-default', colors.text)}>
                      {gateLabel}
                    </span>
                  </SimpleTooltip>

                  {task.isCodyAssigned && (
                    <SimpleTooltip content="Assigned to Cody AI agent" side="bottom">
                      <span className="inline-flex items-center gap-0.5 font-bold text-blue-400 cursor-default">
                        <Bot className="w-3 h-3" />
                        CODY
                      </span>
                    </SimpleTooltip>
                  )}

                  {isActive && <MiniPipelineProgress task={task} variant="inline" />}

                  {task.isTimeout && (
                    <SimpleTooltip
                      content={<SubStatusTooltipContent type="timeout" />}
                      side="bottom"
                    >
                      <span className="hidden sm:inline-flex items-center gap-0.5 font-semibold text-orange-400 cursor-default">
                        <Clock className="w-3 h-3" />
                        Timeout
                      </span>
                    </SimpleTooltip>
                  )}
                  {task.isExhausted && (
                    <SimpleTooltip
                      content={<SubStatusTooltipContent type="exhausted" />}
                      side="bottom"
                    >
                      <span className="hidden sm:inline-flex items-center gap-0.5 font-semibold text-red-400 cursor-default">
                        <RefreshCw className="w-3 h-3" />
                        Exhausted
                      </span>
                    </SimpleTooltip>
                  )}
                  {task.isSupervisorError && (
                    <SimpleTooltip content={<SubStatusTooltipContent type="error" />} side="bottom">
                      <span className="hidden sm:inline-flex items-center gap-0.5 font-semibold text-red-400 cursor-default">
                        <AlertCircle className="w-3 h-3" />
                        Error
                      </span>
                    </SimpleTooltip>
                  )}
                  {task.clarifyWaiting && (
                    <SimpleTooltip
                      content={<SubStatusTooltipContent type="needs-answer" />}
                      side="bottom"
                    >
                      <span className="hidden sm:inline-flex items-center gap-0.5 font-semibold text-blue-400 cursor-default">
                        <AlertCircle className="w-3 h-3" />
                        Needs Answer
                      </span>
                    </SimpleTooltip>
                  )}

                  <span className="text-zinc-600">{formatRelativeTime(task.updatedAt)}</span>

                  {task.labels.length > 0 && (
                    <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-medium truncate max-w-24">
                      {task.labels[0]}
                    </span>
                  )}

                  {hasPR && (
                    <SimpleTooltip content="Open PR in GitHub" side="bottom">
                      <a
                        href={task.associatedPR!.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors font-medium"
                      >
                        <GitPullRequest className="w-3 h-3" />
                        PR
                      </a>
                    </SimpleTooltip>
                  )}

                  {task.previewUrl && (
                    <span className="hidden sm:contents">
                      <SimpleTooltip content="Open deployed preview" side="bottom">
                        <a
                          href={task.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Preview
                        </a>
                      </SimpleTooltip>
                    </span>
                  )}
                </div>
              </div>

              {/* Actions — fade in on hover */}
              <div
                className={cn(
                  'hidden sm:flex items-center gap-1 shrink-0 transition-opacity duration-100',
                  'opacity-100',
                )}
              >
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

                {(task.column === 'building' &&
                  task.workflowRun?.status === 'in_progress' &&
                  onStopTask) ||
                (canExecute && onExecuteTask) ? (
                  <SimpleTooltip
                    content={task.column === 'building' ? 'Stop running task' : 'Run task'}
                    side="bottom"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isExecuting}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (task.column === 'building') onStopTask?.(task)
                        else if (canExecute) onExecuteTask?.(task.id)
                      }}
                      className={cn(
                        'h-7 w-7 p-0 cursor-pointer disabled:opacity-50',
                        task.column === 'building'
                          ? 'text-red-400 hover:bg-red-500/20'
                          : 'text-zinc-400 hover:bg-white/[0.08]',
                      )}
                    >
                      {isExecuting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : task.column === 'building' ? (
                        <Square className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </SimpleTooltip>
                ) : null}

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
                      <SelectTrigger className="h-7 w-auto px-2 text-xs gap-1 border-white/[0.06] bg-transparent hover:bg-white/[0.06]">
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
              </div>
            </div>

            {/* Pipeline progress row */}
            {isActive &&
              task.pipeline &&
              (task.pipeline.currentStage ||
                Object.keys(task.pipeline.stages || {}).length > 0) && (
                <div className="hidden sm:block pb-3 px-4 pl-[52px]">
                  <MiniPipelineProgress task={task} variant="bar" />
                </div>
              )}
          </div>
        )
      })}
    </div>
  )
}
