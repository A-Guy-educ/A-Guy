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
  onAssign?: (issueNumber: number, assignees: string[]) => void
  onUnassign?: (issueNumber: number, assignees: string[]) => void
  collaborators?: { login: string; avatar_url: string }[]
}

// ── Status bar colors ──
const barColor: Record<ColumnId, string> = {
  open: 'bg-zinc-400',
  building: 'bg-blue-500',
  review: 'bg-purple-500',
  failed: 'bg-red-500',
  'gate-waiting': 'bg-yellow-500',
  retrying: 'bg-orange-500',
  done: 'bg-emerald-500',
}

// ── Status icon for the left bar area ──
const statusIcon: Record<ColumnId, React.ReactNode> = {
  open: <CircleDot className="w-5 h-5 text-zinc-400" />,
  building: <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />,
  review: <GitPullRequest className="w-5 h-5 text-purple-500" />,
  failed: <XCircle className="w-5 h-5 text-red-500" />,
  'gate-waiting': <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  retrying: <RotateCcw className="w-5 h-5 text-orange-500" />,
  done: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
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

// ── Issue number color by column ──
const issueNumberColor: Record<ColumnId, string> = {
  open: 'dark:text-zinc-500 text-zinc-500',
  building: 'text-blue-400',
  review: 'text-purple-400',
  failed: 'text-red-400',
  'gate-waiting': 'text-yellow-400',
  retrying: 'text-orange-400',
  done: 'text-emerald-400',
}

// ── Row tint by status ──
const rowTint: Record<ColumnId, string> = {
  open: '',
  building: 'bg-blue-500/[0.03]',
  review: 'bg-purple-500/[0.03]',
  failed: 'bg-red-500/[0.04]',
  'gate-waiting': 'bg-yellow-500/[0.03]',
  retrying: 'bg-orange-500/[0.03]',
  done: 'bg-emerald-500/[0.03]',
}

/** Dot separator between inline metadata items */
function Dot() {
  return (
    <span className="text-zinc-600 text-xs select-none" aria-hidden>
      ·
    </span>
  )
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
    <div>
      <div className="divide-y divide-border/50">
        {tasks.map((task) => {
          const isSelected = task.id === selectedTask?.id
          const isUnassigned = !task.assignees || task.assignees.length === 0
          const canExecute = isUnassigned && task.state === 'open' && onExecuteTask
          const isExecuting = executingTaskId === task.id
          const isMerging = mergingTaskId === task.id
          const hasPR = !!task.associatedPR
          const isHardStop = task.column === 'gate-waiting' && task.gateType === 'hard-stop'
          const isActive = task.column === 'building' || task.column === 'retrying'

          return (
            <div
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className={cn(
                'relative cursor-pointer transition-all duration-150',
                'dark:hover:bg-zinc-800/50 hover:bg-zinc-100',
                rowTint[task.column],
                isSelected && 'dark:bg-zinc-800 bg-white',
                isHardStop && 'ring-2 ring-red-500/40 ring-inset',
              )}
            >
              {/* ═══ Layout: stacked on mobile, inline on desktop ═══ */}
              <div className="flex">
                {/* ── Zone 1: Color bar + status icon ── */}
                <div className="flex items-start shrink-0 pl-0 pt-2 sm:pt-3">
                  <div
                    className={cn(
                      'w-[3px] self-stretch rounded-r',
                      isHardStop ? 'bg-red-500 animate-pulse' : barColor[task.column],
                    )}
                  />
                  <div className="px-2 sm:px-3">{statusIcon[task.column]}</div>
                </div>

                {/* ── Zone 2 + 3 wrapper: stacks on mobile, inline on sm+ ── */}
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center">
                  {/* ── Zone 2: Content (title line + metadata line) ── */}
                  <div className="flex-1 min-w-0 py-2 sm:py-3.5 pr-2">
                    {/* Title line: title + assignee avatars */}
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-medium dark:text-zinc-100 text-zinc-900 truncate flex-1">
                        {task.title}
                      </h3>

                      {/* Assignee avatars — right-aligned on title line */}
                      {task.assignees && task.assignees.length > 0 && (
                        <div className="flex items-center -space-x-1 shrink-0">
                          {task.assignees.map((assignee) => (
                            <SimpleTooltip
                              key={assignee.login}
                              content={assignee.login}
                              side="bottom"
                            >
                              <span className="inline-block">
                                <Avatar className="h-6 w-6 ring-2 ring-zinc-900">
                                  <AvatarImage src={assignee.avatar_url} alt={assignee.login} />
                                  <AvatarFallback className="text-[8px]">
                                    {assignee.login[0]?.toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </span>
                            </SimpleTooltip>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Metadata line: #issue · Status · Pipeline · Time · Labels */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 flex-nowrap sm:flex-wrap overflow-hidden sm:overflow-visible">
                      {/* Issue number — colored by status */}
                      <SimpleTooltip content="View issue on GitHub" side="bottom">
                        <a
                          href={getGitHubIssueUrl(task.issueNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            'text-sm font-mono font-semibold hover:underline shrink-0',
                            issueNumberColor[task.column],
                          )}
                        >
                          #{task.issueNumber}
                        </a>
                      </SimpleTooltip>

                      <Dot />

                      {/* Status label — plain text, no pill */}
                      <SimpleTooltip
                        content={
                          <StatusTooltipContent column={task.column} gateType={task.gateType} />
                        }
                        side="bottom"
                      >
                        <span
                          className={cn(
                            'text-sm font-medium shrink-0 cursor-default',
                            task.column === 'open' && 'dark:text-zinc-400 text-zinc-500',
                            task.column === 'building' && 'text-blue-400',
                            task.column === 'review' && 'text-purple-400',
                            task.column === 'failed' && 'text-red-400',
                            task.column === 'gate-waiting' && 'text-yellow-400',
                            task.column === 'retrying' && 'text-orange-400',
                            task.column === 'done' && 'text-emerald-400',
                          )}
                        >
                          {/* Gate-specific labels */}
                          {task.column === 'gate-waiting' && task.gateType === 'hard-stop'
                            ? 'Hard Stop'
                            : task.column === 'gate-waiting' && task.gateType === 'risk-gated'
                              ? 'Risk Gated'
                              : statusLabel[task.column]}
                        </span>
                      </SimpleTooltip>

                      {/* CODY badge — compact */}
                      {task.isCodyAssigned && (
                        <>
                          <Dot />
                          <SimpleTooltip content="Assigned to Cody AI agent" side="bottom">
                            <span className="shrink-0 inline-flex items-center gap-0.5 text-xs font-bold text-blue-400 cursor-default">
                              <Bot className="w-3 h-3" />
                              CODY
                            </span>
                          </SimpleTooltip>
                        </>
                      )}

                      {/* Pipeline progress inline (for active tasks without their own row) */}
                      {isActive && (
                        <>
                          <Dot />
                          <MiniPipelineProgress task={task} variant="inline" />
                        </>
                      )}

                      {/* Sub-status badges — inline text, no pills */}
                      {task.isTimeout && (
                        <>
                          <Dot />
                          <SimpleTooltip
                            content={<SubStatusTooltipContent type="timeout" />}
                            side="bottom"
                          >
                            <span className="shrink-0 hidden sm:inline-flex items-center gap-0.5 text-xs font-semibold text-orange-400 cursor-default">
                              <Clock className="w-3 h-3" />
                              Timeout
                            </span>
                          </SimpleTooltip>
                        </>
                      )}
                      {task.isExhausted && (
                        <>
                          <Dot />
                          <SimpleTooltip
                            content={<SubStatusTooltipContent type="exhausted" />}
                            side="bottom"
                          >
                            <span className="shrink-0 hidden sm:inline-flex items-center gap-0.5 text-xs font-semibold text-red-400 cursor-default">
                              <RefreshCw className="w-3 h-3" />
                              Exhausted
                            </span>
                          </SimpleTooltip>
                        </>
                      )}
                      {task.isSupervisorError && (
                        <>
                          <Dot />
                          <SimpleTooltip
                            content={<SubStatusTooltipContent type="error" />}
                            side="bottom"
                          >
                            <span className="shrink-0 hidden sm:inline-flex items-center gap-0.5 text-xs font-semibold text-red-400 cursor-default">
                              <AlertCircle className="w-3 h-3" />
                              Error
                            </span>
                          </SimpleTooltip>
                        </>
                      )}
                      {task.clarifyWaiting && (
                        <>
                          <Dot />
                          <SimpleTooltip
                            content={<SubStatusTooltipContent type="needs-answer" />}
                            side="bottom"
                          >
                            <span className="shrink-0 hidden sm:inline-flex items-center gap-0.5 text-xs font-semibold text-blue-400 cursor-default">
                              <AlertCircle className="w-3 h-3" />
                              Needs Answer
                            </span>
                          </SimpleTooltip>
                        </>
                      )}

                      {/* Time */}
                      <Dot />
                      <span className="text-xs text-zinc-500 shrink-0">
                        {formatRelativeTime(task.updatedAt)}
                      </span>

                      {/* First label */}
                      {task.labels.length > 0 && (
                        <span className="hidden sm:contents">
                          <Dot />
                          <span className="text-xs px-1.5 py-0 rounded dark:bg-zinc-700/50 dark:text-zinc-400 bg-zinc-200 text-zinc-600 truncate max-w-20">
                            {task.labels[0]}
                          </span>
                        </span>
                      )}

                      {/* PR link — inline */}
                      {hasPR && (
                        <>
                          <Dot />
                          <SimpleTooltip content="Open PR in GitHub" side="bottom">
                            <a
                              href={task.associatedPR!.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-xs dark:text-purple-400 dark:hover:text-purple-300 text-purple-700 hover:text-purple-800 hover:underline shrink-0"
                            >
                              <GitPullRequest className="w-3 h-3" />
                              PR
                            </a>
                          </SimpleTooltip>
                        </>
                      )}

                      {/* Preview link — inline */}
                      {task.previewUrl && (
                        <span className="hidden sm:contents">
                          <Dot />
                          <SimpleTooltip
                            content={
                              <div className="space-y-1">
                                <p className="text-xs font-semibold">🔗 Preview Available</p>
                                <p className="text-xs text-muted-foreground">
                                  Click to open the deployed preview in a new tab
                                </p>
                              </div>
                            }
                            side="bottom"
                          >
                            <a
                              href={task.previewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-xs text-emerald-400 hover:text-emerald-300 hover:underline shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Preview
                            </a>
                          </SimpleTooltip>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Zone 3: Actions ── */}
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0 pr-3 sm:pl-2 sm:pb-0">
                    {/* Merge button */}
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

                    {/* Run / Stop button */}
                    {(task.column === 'building' &&
                      task.workflowRun?.status === 'in_progress' &&
                      onStopTask) ||
                    (canExecute && onExecuteTask) ? (
                      <SimpleTooltip
                        content={
                          task.column === 'building'
                            ? 'Stop running task'
                            : 'Start running this task'
                        }
                        side="bottom"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isExecuting}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (task.column === 'building') {
                              onStopTask?.(task)
                            } else if (canExecute) {
                              onExecuteTask?.(task.id)
                            }
                          }}
                          className={cn(
                            'h-8 text-sm px-2.5 gap-1.5 cursor-pointer disabled:opacity-50',
                            task.column === 'building'
                              ? 'text-red-400 bg-red-500/10 hover:bg-red-500/30'
                              : 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/30',
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
                      </SimpleTooltip>
                    ) : null}

                    {/* Assign picker */}
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
                          <SelectTrigger className="h-8 w-auto px-3 text-sm gap-1.5">
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
              </div>

              {/* ═══ Pipeline progress row — only for active (building/retrying) tasks with rich data ═══ */}
              {isActive &&
                task.pipeline &&
                (task.pipeline.currentStage ||
                  Object.keys(task.pipeline.stages || {}).length > 0) && (
                  <div className="hidden sm:block pb-2 pl-10 sm:pl-12 pr-3">
                    <MiniPipelineProgress task={task} variant="bar" />
                  </div>
                )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
