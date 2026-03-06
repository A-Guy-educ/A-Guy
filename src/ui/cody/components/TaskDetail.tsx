/**
 * @fileType component
 * @domain cody
 * @pattern task-detail
 * @ai-summary Task detail — v2 with header quick-links, consolidated sidebar, contextual actions, inline pipeline timeline
 */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatRelativeTime, cn } from '../utils'
import { getGitHubIssueUrl } from '../constants'
import type { CodyTask, GitHubComment, ColumnId, CodyPipelineStatus } from '../types'
import { ALL_STAGES } from '../constants'
import { calculatePipelineProgress, stageLabels, formatElapsed } from '../pipeline-utils'
import { PipelineStatus } from './PipelineStatus'
import { CommentEditor } from './CommentEditor'
import { CommentList } from './CommentList'
import { TaskPreviewTab } from './TaskPreviewTab'
import { AssigneePicker, type AssigneeChangeEvent } from './AssigneePicker'
import { MergeButton } from './MergeButton'
import { Button } from '@/ui/web/components/button'
import { Badge } from '@/ui/web/components/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/web/components/avatar'
import { useTaskActions, useTaskDetails, useRetryWithContext, queryKeys } from '../hooks'
import { useQueryClient } from '@tanstack/react-query'
import { useGitHubIdentity } from '../hooks/useGitHubIdentity'
import {
  GitPullRequest,
  ExternalLink,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Zap,
  ShieldCheck,
  ShieldX,
  RotateCcw,
  Ban,
  Send,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Github,
  Info,
  FileText,
  MessageSquare,
  GitBranch,
  BookOpen,
  MoreHorizontal,
  Timer,
} from 'lucide-react'

interface TaskDetailProps {
  onApproveReview?: (task: CodyTask) => Promise<void>
  isMerging?: boolean
  task: CodyTask | null
  onClose?: () => void
  onRefresh?: () => void
}

interface FullTaskDetails extends CodyTask {
  assignees: Array<{ login: string; avatar_url: string }>
  comments: GitHubComment[]
}

// ============ CONSTANTS ============

const columnColors: Record<
  ColumnId,
  { bg: string; text: string; bar: string; pill: string; wash: string }
> = {
  open: {
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    bar: 'bg-zinc-400',
    pill: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    wash: 'from-zinc-500/5',
  },
  building: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    bar: 'bg-blue-500',
    pill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    wash: 'from-blue-500/5',
  },
  review: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    bar: 'bg-purple-500',
    pill: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
    wash: 'from-purple-500/5',
  },
  failed: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    bar: 'bg-red-500',
    pill: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    wash: 'from-red-500/5',
  },
  'gate-waiting': {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    bar: 'bg-yellow-500',
    pill: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
    wash: 'from-yellow-500/5',
  },
  retrying: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    bar: 'bg-orange-500',
    pill: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
    wash: 'from-orange-500/5',
  },
  done: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    bar: 'bg-emerald-500',
    pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    wash: 'from-emerald-500/5',
  },
}

const columnLabels: Record<ColumnId, string> = {
  open: 'Backlog',
  building: 'Building',
  review: 'In Review',
  failed: 'Failed',
  'gate-waiting': 'Gate Waiting',
  retrying: 'Retrying',
  done: 'Done',
}

// ============ SUB-COMPONENTS ============

// Tab button with optional count badge
function TabButton({
  active,
  onClick,
  label,
  icon: Icon,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: React.ElementType
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-0.5 px-1.5 py-0.5 text-xs font-medium bg-muted rounded-full">
          {count}
        </span>
      )}
    </button>
  )
}

// Status badge with pipeline state indicator
function StatusBadge({ column, pipelineState }: { column: ColumnId; pipelineState?: string }) {
  const colors = columnColors[column]
  const isRunning = pipelineState === 'running'

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${colors.pill}`}
    >
      {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
      {pipelineState === 'completed' && <CheckCircle className="w-3 h-3" />}
      {pipelineState === 'failed' && <XCircle className="w-3 h-3" />}
      {columnLabels[column]}
    </span>
  )
}

// ── Contextual Primary Action ──
// Returns the ONE most important action for the current state
function getPrimaryAction(
  task: CodyTask,
  fullDetails: FullTaskDetails | null,
  taskActions: ReturnType<typeof useTaskActions>,
  completedActions: Set<string>,
  setCompletedActions: React.Dispatch<React.SetStateAction<Set<string>>>,
): {
  icon: React.ElementType
  label: string
  pendingLabel: string
  onClick: () => void
  pendingKey: string
  variant: 'blue' | 'yellow' | 'red' | 'green'
} | null {
  // Gate waiting → Approve
  if (task.column === 'gate-waiting' && !completedActions.has('approve')) {
    return {
      icon: ShieldCheck,
      label: 'Approve Gate',
      pendingLabel: 'Approving…',
      onClick: () => {
        setCompletedActions((prev) => new Set([...prev, 'approve']))
        taskActions.approveGate()
      },
      pendingKey: 'approve',
      variant: 'yellow',
    }
  }
  // Failed → Retry
  if (task.column === 'failed') {
    return {
      icon: RotateCcw,
      label: 'Retry',
      pendingLabel: 'Retrying…',
      onClick: () => taskActions.execute(),
      pendingKey: 'execute',
      variant: 'red',
    }
  }
  // Open + unassigned + in backlog → Run Task (not for review/done/building/gate columns)
  if (
    task.state === 'open' &&
    task.column === 'open' &&
    (!fullDetails?.assignees || fullDetails.assignees.length === 0)
  ) {
    return {
      icon: Zap,
      label: 'Run Task',
      pendingLabel: 'Starting…',
      onClick: () => taskActions.execute(),
      pendingKey: 'execute',
      variant: 'blue',
    }
  }
  return null
}

// Secondary/overflow actions
function getOverflowActions(
  task: CodyTask,
  taskActions: ReturnType<typeof useTaskActions>,
  completedActions: Set<string>,
  setCompletedActions: React.Dispatch<React.SetStateAction<Set<string>>>,
): Array<{
  icon: React.ElementType
  label: string
  pendingLabel: string
  onClick: () => void
  pendingKey: string
  destructive?: boolean
  confirmMessage?: string
}> {
  const actions: Array<{
    icon: React.ElementType
    label: string
    pendingLabel: string
    onClick: () => void
    pendingKey: string
    destructive?: boolean
    confirmMessage?: string
  }> = []

  // Stop (if running)
  if (task.pipeline?.state === 'running') {
    actions.push({
      icon: Ban,
      label: 'Stop',
      pendingLabel: 'Stopping…',
      onClick: () => taskActions.abort(),
      pendingKey: 'abort',
      destructive: true,
    })
  }

  // Reject Gate
  if (task.column === 'gate-waiting' && !completedActions.has('reject')) {
    actions.push({
      icon: ShieldX,
      label: 'Reject Gate',
      pendingLabel: 'Rejecting…',
      onClick: () => {
        setCompletedActions((prev) => new Set([...prev, 'reject']))
        taskActions.rejectGate()
      },
      pendingKey: 'reject',
      destructive: true,
    })
  }

  // Close PR
  if (task.associatedPR && task.associatedPR.state === 'open') {
    actions.push({
      icon: XCircle,
      label: 'Close PR',
      pendingLabel: 'Closing…',
      onClick: () => taskActions.closePR(),
      pendingKey: 'close-pr',
      confirmMessage: `Close PR #${task.associatedPR.number}? This will NOT delete the branch.`,
    })
  }

  // Close / Reopen Issue
  actions.push({
    icon: task.state === 'open' ? XCircle : RotateCcw,
    label: task.state === 'open' ? 'Close Issue' : 'Reopen Issue',
    pendingLabel: task.state === 'open' ? 'Closing…' : 'Reopening…',
    onClick: () => (task.state === 'open' ? taskActions.close() : taskActions.reopen()),
    pendingKey: task.state === 'open' ? 'close' : 'reopen',
  })

  // Reset
  if (
    (task.column === 'done' || task.column === 'failed' || task.associatedPR) &&
    task.state === 'open'
  ) {
    actions.push({
      icon: RotateCcw,
      label: 'Reset & Re-run',
      pendingLabel: 'Resetting…',
      onClick: () => taskActions.reset(),
      pendingKey: 'reset',
      confirmMessage:
        'This will delete the branch, close the PR, remove all agent labels, and re-run the pipeline from scratch. Continue?',
    })
  }

  return actions
}

// Overflow menu component
function OverflowMenu({
  actions,
  isPending,
  pendingAction,
}: {
  actions: ReturnType<typeof getOverflowActions>
  isPending: boolean
  pendingAction: string | null
}) {
  const [open, setOpen] = useState(false)

  if (actions.length === 0) return null

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => setOpen(!open)}
        title="More actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Menu */}
          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-popover border border-border rounded-lg shadow-lg py-1">
            {actions.map((action) => {
              const isActionPending = pendingAction === action.pendingKey
              const handleClick = () => {
                if (action.confirmMessage) {
                  if (!confirm(action.confirmMessage)) return
                }
                action.onClick()
                setOpen(false)
              }
              return (
                <button
                  key={action.label}
                  onClick={handleClick}
                  disabled={isPending}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                    action.destructive
                      ? 'text-red-400 hover:bg-red-500/10'
                      : 'text-foreground hover:bg-muted',
                    isPending && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {isActionPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <action.icon className="w-3.5 h-3.5" />
                  )}
                  {isActionPending ? action.pendingLabel : action.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Inline Pipeline Timeline for main content ──
function InlinePipelineTimeline({ pipeline }: { pipeline: CodyPipelineStatus }) {
  const progress = calculatePipelineProgress(pipeline)
  const isRunning = pipeline.state === 'running'
  const isPaused = pipeline.state === 'paused'

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/10">
      {/* Stage dots */}
      <div className="flex items-center gap-1">
        {ALL_STAGES.map((stage, i) => {
          const isCompleted = i < progress.currentStageIndex
          const isCurrent = i === progress.currentStageIndex
          const isPendingStage = i > progress.currentStageIndex

          return (
            <div
              key={stage}
              className={cn(
                'rounded-full transition-all duration-300',
                isCurrent ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5',
                isCompleted && 'bg-blue-500',
                isCurrent &&
                  isRunning &&
                  'bg-blue-400 animate-pulse shadow-[0_0_6px_rgba(96,165,250,0.6)]',
                isCurrent && isPaused && 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]',
                isPendingStage && 'bg-zinc-600/40',
              )}
              title={stageLabels[stage] || stage}
            />
          )
        })}
      </div>

      {/* Label */}
      <span
        className={cn(
          'text-sm font-medium',
          isRunning && 'text-blue-400',
          isPaused && 'text-yellow-400',
        )}
      >
        {progress.currentStageLabel}
      </span>

      {/* Step counter */}
      <span className="text-xs text-zinc-500 font-mono tabular-nums">
        {progress.stepNumber}/{progress.totalStages}
      </span>

      {/* Elapsed time */}
      {pipeline.startedAt && (
        <span className="text-xs text-zinc-500 font-mono tabular-nums flex items-center gap-0.5 ml-auto">
          <Timer className="w-3 h-3" />
          {formatElapsed(new Date(pipeline.startedAt))}
        </span>
      )}
    </div>
  )
}

// ============ MAIN COMPONENT ============

export function TaskDetail({
  task,
  onClose,
  onRefresh,
  onApproveReview,
  isMerging: externalIsMerging,
}: TaskDetailProps) {
  const { githubUser } = useGitHubIdentity()
  const actorLogin = githubUser?.login

  const queryClient = useQueryClient()
  const [assigneeOverride, setAssigneeOverride] = useState<Array<{
    login: string
    avatar_url: string
  }> | null>(null)

  const {
    data: details,
    refetch,
    isFetching: isDetailsFetching,
  } = useTaskDetails(task?.issueNumber ?? null, actorLogin)
  const [activeTab, setActiveTab] = useState<'description' | 'comments' | 'changes' | 'docs'>(
    'description',
  )
  const [retryContext, setRetryContext] = useState('')
  const [showRetryContext, setShowRetryContext] = useState(false)
  const [showMobileExtra, setShowMobileExtra] = useState(false)
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    refetch()
    onRefresh?.()
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    refreshTimeoutRef.current = setTimeout(() => setIsRefreshing(false), 600)
  }, [refetch, onRefresh])

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    setCompletedActions(new Set())
    setShowMobileExtra(false)
    setActiveTab('description')
  }, [task?.issueNumber])

  const retryWithContext = useRetryWithContext({
    issueNumber: task?.issueNumber ?? 0,
    actorLogin,
    onSuccess: () => {
      setRetryContext('')
      setShowRetryContext(false)
      onRefresh?.()
      refetch()
    },
  })

  const taskActions = useTaskActions({
    issueNumber: task?.issueNumber ?? 0,
    actorLogin,
    onSuccess: () => {
      onRefresh?.()
      refetch()
    },
  })

  const fullDetails: FullTaskDetails | null = (() => {
    if (!details?.task || !task) return null
    return {
      ...task,
      assignees: assigneeOverride ?? details.assignees ?? [],
      comments: (details.comments as GitHubComment[]) || [],
    }
  })()

  // Clear optimistic override once server data refreshes
  useEffect(() => {
    if (assigneeOverride && details?.assignees) {
      setAssigneeOverride(null)
    }
  }, [details?.assignees]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
            <Info className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-base">Select a task to view details</p>
        </div>
      </div>
    )
  }

  const hasDescription = task.body && task.body.trim().length > 0
  const commentsCount = fullDetails?.comments?.length || 0
  const hasPR = !!task.associatedPR
  const showPipelineTimeline =
    task.pipeline &&
    (task.pipeline.state === 'running' || task.pipeline.state === 'paused') &&
    task.pipeline.currentStage

  // Contextual actions
  const primaryAction = getPrimaryAction(
    task,
    fullDetails,
    taskActions,
    completedActions,
    setCompletedActions,
  )
  const overflowActions = getOverflowActions(
    task,
    taskActions,
    completedActions,
    setCompletedActions,
  )

  // --- Shared markdown components ---
  const markdownComponents = {
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-3 last:mb-0 text-base text-muted-foreground leading-relaxed">{children}</p>
    ),
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:underline"
      >
        {children}
      </a>
    ),
    code: ({
      className,
      children,
      ...props
    }: {
      className?: string
      children?: React.ReactNode
    }) => {
      const isBlock = className?.includes('language-')
      if (isBlock) {
        return (
          <pre className="bg-muted/50 p-3 rounded-md text-sm overflow-x-auto my-3">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        )
      }
      return (
        <code className="bg-muted/50 px-1.5 py-0.5 rounded text-sm text-foreground" {...props}>
          {children}
        </code>
      )
    },
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc pl-6 space-y-1 text-base text-muted-foreground my-2">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal pl-6 space-y-1 text-base text-muted-foreground my-2">
        {children}
      </ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-base text-muted-foreground leading-relaxed">{children}</li>
    ),
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-xl font-bold text-foreground mt-6 mb-2 first:mt-0 border-b border-border pb-1">
        {children}
      </h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-lg font-bold text-foreground mt-5 mb-2 first:mt-0">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-base font-semibold text-foreground mt-4 mb-1.5">{children}</h3>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className="text-base font-medium text-foreground mt-3 mb-1">{children}</h4>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-3 border-blue-500/40 pl-4 my-3 text-base italic text-muted-foreground bg-muted/20 py-2 rounded-r-md">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-border my-4" />,
    table: ({ children }: { children?: React.ReactNode }) => (
      <div className="overflow-x-auto my-3 rounded-md border border-border">
        <table className="text-xs border-collapse w-full">{children}</table>
      </div>
    ),
    thead: ({ children }: { children?: React.ReactNode }) => (
      <thead className="bg-muted/40">{children}</thead>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
      <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground text-xs">
        {children}
      </th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td className="border-b border-border/50 px-3 py-2 text-muted-foreground text-xs">
        {children}
      </td>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic text-muted-foreground">{children}</em>
    ),
  }

  // --- Retry With Context Block ---
  const retryWithContextBlock = task.column === 'failed' && (
    <div className="border-t border-orange-500/20 bg-orange-500/5 mt-2">
      <button
        onClick={() => setShowRetryContext(!showRetryContext)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-orange-500/10 transition-colors rounded-b-lg"
      >
        <span className="text-sm font-medium text-orange-400 flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5" />
          Retry with Context
        </span>
        {showRetryContext ? (
          <ChevronUp className="w-4 h-4 text-orange-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-orange-400" />
        )}
      </button>
      {showRetryContext && (
        <div className="px-4 pb-3 space-y-2">
          <textarea
            value={retryContext}
            onChange={(e) => setRetryContext(e.target.value)}
            placeholder="Add context for the retry…"
            className="w-full h-20 px-3 py-2 text-base bg-background border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Posts <code className="text-orange-400">@cody retry</code> + context
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
              onClick={() => retryWithContext.mutate(retryContext)}
              disabled={retryWithContext.isPending}
            >
              {retryWithContext.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 mr-1" />
              )}
              {retryWithContext.isPending ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  // --- Tab Configuration (improvement #6: conditional tabs with counts) ---
  const tabs = [
    ...(hasDescription
      ? [{ key: 'description' as const, label: 'Description', icon: FileText }]
      : []),
    { key: 'comments' as const, label: 'Comments', icon: MessageSquare, count: commentsCount },
    ...(hasPR ? [{ key: 'changes' as const, label: 'Changes', icon: GitBranch }] : []),
    ...(hasPR ? [{ key: 'docs' as const, label: 'Docs', icon: BookOpen }] : []),
  ]

  // Compute effective tab: if current tab was removed (e.g. no PR → no Changes/Docs), fallback
  const validKeys = tabs.map((t) => t.key)
  const effectiveTab = validKeys.includes(activeTab) ? activeTab : validKeys[0] || 'comments'

  // --- Tab Bar ---
  const tabBar = (
    <div className="flex border-b border-border shrink-0 overflow-x-auto">
      {tabs.map(({ key, label, icon, count }) => (
        <TabButton
          key={key}
          active={effectiveTab === key}
          onClick={() => setActiveTab(key)}
          label={label}
          icon={icon}
          count={count}
        />
      ))}
    </div>
  )

  // --- Tab Content ---
  const tabContent = (
    <>
      {effectiveTab === 'description' && hasDescription && (
        <div className="p-5 md:p-6 overflow-y-auto h-full">
          <div className="max-w-3xl">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {task.body!}
            </ReactMarkdown>
          </div>
        </div>
      )}
      {effectiveTab === 'comments' && (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-4">
            <CommentList comments={fullDetails?.comments || []} loading={isDetailsFetching} />
          </div>
          <div className="shrink-0 border-t border-border p-3 bg-muted/10">
            <CommentEditor issueNumber={task.issueNumber} onCommentPosted={() => refetch()} />
          </div>
          {retryWithContextBlock}
        </div>
      )}
      {(effectiveTab === 'changes' || effectiveTab === 'docs') && (
        <div className="p-4 overflow-y-auto h-full">
          <TaskPreviewTab task={task} activeTab={effectiveTab as 'changes' | 'docs'} />
        </div>
      )}
    </>
  )

  // --- Assignee handler (shared between desktop & mobile) ---
  const handleAssigneeChange = (event: AssigneeChangeEvent) => {
    const current = fullDetails?.assignees || []
    if (event.action === 'assign') {
      setAssigneeOverride([...current, { login: event.login, avatar_url: event.avatar_url }])
    } else {
      setAssigneeOverride(current.filter((a) => a.login !== event.login))
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.taskDetails(task.issueNumber) })
    queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
    onRefresh?.()
  }

  // Primary action button colors
  const primaryVariantStyles = {
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25',
    yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/25',
    red: 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25',
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25',
  }

  // --- Header (improved: thicker bar, wash, quick links as icons) ---
  const header = (
    <>
      {/* Improvement #5: Thicker accent bar */}
      <div className={`h-2 ${columnColors[task.column].bar} shrink-0`} />

      {/* Header content with subtle status-colored wash */}
      <div
        className={`px-4 md:px-5 pt-3 md:pt-4 pb-3 border-b border-border bg-gradient-to-b ${columnColors[task.column].wash} to-transparent`}
      >
        {/* Row 1: Status + Timestamp (left) | Refresh + Close (right) */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <StatusBadge column={task.column} pipelineState={task.pipeline?.state} />
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(task.updatedAt)}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh"
              className="h-8 w-8 p-0"
            >
              <RefreshCw
                className={`w-4 h-4 transition-transform ${isRefreshing ? 'animate-spin text-blue-400' : ''}`}
              />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Row 2: Title */}
        <h2 className="text-lg md:text-xl font-semibold text-foreground leading-snug pr-8 mb-3">
          {task.title}
        </h2>

        {/* Row 3: Quick link pills (left) | Actions (right) */}
        <div className="flex items-center justify-between gap-3">
          {/* Quick link pills - labeled, easy to read */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <a
              href={getGitHubIssueUrl(task.issueNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Github className="w-3 h-3" />#{task.issueNumber}
            </a>
            {task.associatedPR && (
              <a
                href={task.associatedPR.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
              >
                <GitPullRequest className="w-3 h-3" />
                PR #{task.associatedPR.number}
              </a>
            )}
            {task.workflowRun && (
              <a
                href={task.workflowRun.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Play className="w-3 h-3" />
                Workflow
              </a>
            )}
            {task.previewUrl && (
              <a
                href={task.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Preview
              </a>
            )}
          </div>

          {/* Right side: Merge (if review) + Primary action + Overflow */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Merge button (in review) */}
            {task.column === 'review' && task.associatedPR && onApproveReview && (
              <MergeButton
                prNumber={task.associatedPR.number}
                prTitle={task.associatedPR.title}
                branchName={task.associatedPR.head.ref}
                isMerging={externalIsMerging ?? false}
                onMerge={() => onApproveReview(task)}
              />
            )}

            {/* Contextual primary action */}
            {primaryAction && (
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 gap-1.5 text-sm font-medium',
                  primaryVariantStyles[primaryAction.variant],
                )}
                onClick={primaryAction.onClick}
                disabled={taskActions.isPending}
              >
                {taskActions.pendingAction === primaryAction.pendingKey ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <primaryAction.icon className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {taskActions.pendingAction === primaryAction.pendingKey
                    ? primaryAction.pendingLabel
                    : primaryAction.label}
                </span>
              </Button>
            )}

            {/* Overflow menu */}
            <OverflowMenu
              actions={overflowActions}
              isPending={taskActions.isPending}
              pendingAction={taskActions.pendingAction}
            />
          </div>
        </div>

        {/* Sub-status badges (below row 3) */}
        {(task.column === 'gate-waiting' ||
          task.isTimeout ||
          task.isExhausted ||
          task.isSupervisorError ||
          task.clarifyWaiting) && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {task.column === 'gate-waiting' && task.gateType === 'hard-stop' && (
              <Badge variant="destructive" className="text-xs px-2 py-0.5">
                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> HARD STOP
              </Badge>
            )}
            {task.isTimeout && (
              <Badge
                variant="outline"
                className="border-orange-500/50 text-orange-400 text-xs px-2 py-0.5"
              >
                ⏰ TIMEOUT
              </Badge>
            )}
            {task.isExhausted && (
              <Badge
                variant="outline"
                className="border-orange-500/50 text-orange-400 text-xs px-2 py-0.5"
              >
                EXHAUSTED
              </Badge>
            )}
            {task.isSupervisorError && (
              <Badge variant="destructive" className="text-xs px-2 py-0.5">
                ERROR
              </Badge>
            )}
            {task.clarifyWaiting && (
              <Badge
                variant="outline"
                className="border-blue-500/50 text-blue-400 text-xs px-2 py-0.5"
              >
                💬 NEEDS ANSWER
              </Badge>
            )}
          </div>
        )}
      </div>
    </>
  )

  // --- Desktop Layout: sidebar with card styling ---
  const desktopLayout = (
    <div className="hidden md:flex flex-1 min-h-0 overflow-hidden">
      {/* Left sidebar — with card styling */}
      <div className="w-56 shrink-0 border-r border-border overflow-y-auto bg-muted/5">
        <div className="p-4 space-y-4">
          {/* Card: People & Labels — merged into one section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              People & Labels
            </h4>
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50 space-y-3">
              {/* Assignees */}
              <AssigneePicker
                issueNumber={task.issueNumber}
                currentAssignees={fullDetails?.assignees || []}
                onChange={handleAssigneeChange}
              />

              {/* Labels - below assignees with separator */}
              {task.labels.length > 0 && (
                <div className="pt-2 border-t border-border/30">
                  <div className="flex flex-wrap gap-1">
                    {task.labels.map((label) => (
                      <Badge key={label} variant="outline" className="text-xs font-normal">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pipeline — as separate card, only if exists */}
          {task.pipeline && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pipeline
              </h4>
              <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                <PipelineStatus status={task.pipeline} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Improvement #7: Inline pipeline timeline above tabs */}
        {showPipelineTimeline && <InlinePipelineTimeline pipeline={task.pipeline!} />}
        {tabBar}
        <div className="flex-1 min-h-0 overflow-hidden">{tabContent}</div>
      </div>
    </div>
  )

  // --- Mobile Layout (improvement #4: show assignees + primary action by default) ---
  const mobileLayout = (
    <div className="md:hidden flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Mobile top section — always visible: assignees + primary action */}
      <div className="shrink-0 px-3 py-3 border-b border-border space-y-2">
        {/* Assignees row — always visible */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium shrink-0">Assigned:</span>
          {fullDetails?.assignees && fullDetails.assignees.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {fullDetails.assignees.map((assignee) => (
                <div
                  key={assignee.login}
                  className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded"
                >
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={assignee.avatar_url} alt={assignee.login} />
                    <AvatarFallback className="text-[9px]">
                      {assignee.login[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs">{assignee.login}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">Unassigned</span>
          )}
        </div>

        {/* Toggle for labels, pipeline, full assignee picker */}
        <button
          onClick={() => setShowMobileExtra(!showMobileExtra)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
        >
          <Info className="w-3.5 h-3.5" />
          <span>{showMobileExtra ? 'Hide details' : 'More details'}</span>
          {showMobileExtra ? (
            <ChevronUp className="w-3.5 h-3.5 ml-auto" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 ml-auto" />
          )}
        </button>

        {showMobileExtra && (
          <div className="space-y-3 pb-2">
            {/* Labels */}
            {task.labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.labels.map((label) => (
                  <Badge key={label} variant="outline" className="text-xs font-normal">
                    {label}
                  </Badge>
                ))}
              </div>
            )}

            {/* Full assignee picker */}
            <AssigneePicker
              issueNumber={task.issueNumber}
              currentAssignees={fullDetails?.assignees || []}
              onChange={handleAssigneeChange}
            />

            {/* Pipeline */}
            {task.pipeline && <PipelineStatus status={task.pipeline} />}
          </div>
        )}
      </div>

      {/* Inline pipeline timeline (mobile) */}
      {showPipelineTimeline && <InlinePipelineTimeline pipeline={task.pipeline!} />}

      {/* Mobile tabs + content */}
      {tabBar}
      <div className="flex-1 min-h-0 overflow-hidden">{tabContent}</div>
    </div>
  )

  return (
    <div className="h-full flex flex-col bg-card rounded-lg overflow-hidden border border-border shadow-sm">
      {header}
      {desktopLayout}
      {mobileLayout}
    </div>
  )
}
