/**
 * @fileType component
 * @domain cody
 * @pattern task-detail
 * @ai-summary Task detail — redesigned with improved visual hierarchy and organized sub-components
 */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatRelativeTime } from '../utils'
import { getGitHubIssueUrl } from '../constants'
import type { CodyTask, GitHubComment, ColumnId } from '../types'
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
  Link2,
  FileText,
  MessageSquare,
  GitBranch,
  BookOpen,
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

const columnColors: Record<ColumnId, { bg: string; text: string; bar: string; pill: string }> = {
  open: {
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    bar: 'bg-zinc-400',
    pill: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  },
  building: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    bar: 'bg-blue-500',
    pill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  },
  review: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    bar: 'bg-purple-500',
    pill: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  },
  failed: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    bar: 'bg-red-500',
    pill: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  },
  'gate-waiting': {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    bar: 'bg-yellow-500',
    pill: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  },
  retrying: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    bar: 'bg-orange-500',
    pill: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  },
  done: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    bar: 'bg-emerald-500',
    pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
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

// Quick link button component
function QuickLinkButton({
  href,
  icon: Icon,
  label,
  variant = 'default',
}: {
  href: string
  icon: React.ElementType
  label: string
  variant?: 'default' | 'purple' | 'green'
}) {
  const variantStyles = {
    default: 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
    purple: 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20',
    green: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors ${variantStyles[variant]}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </a>
  )
}

// Section card for sidebar - creates visual grouping
function SidebarSection({
  title,
  children,
  icon: Icon,
}: {
  title: string
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {title}
      </h4>
      <div className="bg-muted/30 rounded-lg p-3 border border-border/50">{children}</div>
    </div>
  )
}

// Action button with different visual styles based on importance
function ActionButton({
  onClick,
  icon: Icon,
  label,
  variant = 'secondary',
  disabled = false,
  confirmMessage,
  isPending = false,
}: {
  onClick: () => void
  icon: React.ElementType
  label: string
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'
  disabled?: boolean
  confirmMessage?: string
  isPending?: boolean
}) {
  const variantStyles = {
    primary: 'text-blue-400 border-blue-500/20 hover:bg-blue-500/10 hover:border-blue-500/40',
    secondary: 'text-foreground border-border hover:bg-muted',
    destructive: 'text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40',
    ghost: 'text-muted-foreground hover:text-foreground hover:bg-muted border-transparent',
  }

  const handleClick = () => {
    if (confirmMessage) {
      if (confirm(confirmMessage)) onClick()
    } else {
      onClick()
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={`w-full justify-start ${variantStyles[variant]}`}
      onClick={handleClick}
      disabled={disabled || isPending}
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5 mr-1.5" />
      )}
      {label}
    </Button>
  )
}

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
        <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded-full">
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.pill}`}
    >
      {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
      {pipelineState === 'completed' && <CheckCircle className="w-3 h-3" />}
      {pipelineState === 'failed' && <XCircle className="w-3 h-3" />}
      {columnLabels[column]}
    </span>
  )
}

// Helper icons
function TagIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42L12 2Z" />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
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
  const [showMobileInfo, setShowMobileInfo] = useState(false)
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
    setShowMobileInfo(false)
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
          <p className="text-sm">Select a task to view details</p>
        </div>
      </div>
    )
  }

  const hasDescription = task.body && task.body.trim().length > 0
  const commentsCount = fullDetails?.comments?.length || 0

  // --- Shared markdown components ---
  const markdownComponents = {
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-3 last:mb-0 text-sm text-muted-foreground leading-relaxed">{children}</p>
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
          <pre className="bg-muted/50 p-3 rounded-md text-xs overflow-x-auto my-3">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        )
      }
      return (
        <code className="bg-muted/50 px-1.5 py-0.5 rounded text-xs text-foreground" {...props}>
          {children}
        </code>
      )
    },
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground my-2">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal pl-6 space-y-1 text-sm text-muted-foreground my-2">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-sm text-muted-foreground leading-relaxed">{children}</li>
    ),
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-lg font-bold text-foreground mt-6 mb-2 first:mt-0 border-b border-border pb-1">
        {children}
      </h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-base font-bold text-foreground mt-5 mb-2 first:mt-0">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-sm font-semibold text-foreground mt-4 mb-1.5">{children}</h3>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className="text-sm font-medium text-foreground mt-3 mb-1">{children}</h4>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-3 border-blue-500/40 pl-4 my-3 text-sm italic text-muted-foreground bg-muted/20 py-2 rounded-r-md">
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

  // --- Quick Links ---
  const quickLinks = (
    <div className="flex flex-wrap gap-1.5">
      <QuickLinkButton
        href={getGitHubIssueUrl(task.issueNumber)}
        icon={Github}
        label={`#${task.issueNumber}`}
      />
      {task.associatedPR && (
        <>
          <QuickLinkButton
            href={task.associatedPR.html_url}
            icon={GitPullRequest}
            label={`PR #${task.associatedPR.number}`}
            variant="purple"
          />
          {task.column === 'review' && onApproveReview && (
            <MergeButton
              prNumber={task.associatedPR.number}
              prTitle={task.associatedPR.title}
              branchName={task.associatedPR.head.ref}
              isMerging={externalIsMerging ?? false}
              onMerge={() => onApproveReview(task)}
            />
          )}
        </>
      )}
      {task.previewUrl && (
        <QuickLinkButton
          href={task.previewUrl}
          icon={ExternalLink}
          label="Preview"
          variant="green"
        />
      )}
      {task.workflowRun && (
        <QuickLinkButton href={task.workflowRun.html_url} icon={Play} label="Workflow" />
      )}
    </div>
  )

  // --- Action Buttons Grouped by Importance ---
  const actionButtons = (
    <div className="space-y-2">
      {/* Primary Actions - Run / Approve / Retry */}
      <div className="space-y-1">
        {task.state === 'open' &&
          (!fullDetails?.assignees || fullDetails.assignees.length === 0) && (
            <ActionButton
              onClick={() => taskActions.execute()}
              icon={Zap}
              label={taskActions.pendingAction === 'execute' ? 'Starting…' : 'Run Task'}
              variant="primary"
              isPending={taskActions.pendingAction === 'execute'}
              disabled={taskActions.isPending}
            />
          )}
        {task.column === 'gate-waiting' && !completedActions.has('approve') && (
          <ActionButton
            onClick={() => {
              setCompletedActions((prev) => new Set([...prev, 'approve']))
              taskActions.approveGate()
            }}
            icon={ShieldCheck}
            label={taskActions.pendingAction === 'approve' ? 'Approving…' : 'Approve Gate'}
            variant="primary"
            isPending={taskActions.pendingAction === 'approve'}
            disabled={taskActions.isPending}
          />
        )}
        {task.column === 'failed' && (
          <ActionButton
            onClick={() => taskActions.execute()}
            icon={RotateCcw}
            label={taskActions.pendingAction === 'execute' ? 'Retrying…' : 'Retry'}
            variant="primary"
            isPending={taskActions.pendingAction === 'execute'}
            disabled={taskActions.isPending}
          />
        )}
      </div>

      {/* Secondary Actions - Stop / Reject */}
      <div className="space-y-1">
        {task.pipeline?.state === 'running' && (
          <ActionButton
            onClick={() => taskActions.abort()}
            icon={Ban}
            label={taskActions.pendingAction === 'abort' ? 'Stopping…' : 'Stop'}
            variant="destructive"
            isPending={taskActions.pendingAction === 'abort'}
            disabled={taskActions.isPending}
          />
        )}
        {task.column === 'gate-waiting' && !completedActions.has('reject') && (
          <ActionButton
            onClick={() => {
              setCompletedActions((prev) => new Set([...prev, 'reject']))
              taskActions.rejectGate()
            }}
            icon={ShieldX}
            label={taskActions.pendingAction === 'reject' ? 'Rejecting…' : 'Reject Gate'}
            variant="destructive"
            isPending={taskActions.pendingAction === 'reject'}
            disabled={taskActions.isPending}
          />
        )}
      </div>

      {/* Tertiary Actions - Close PR / Close Issue / Reset */}
      <div className="space-y-1 pt-2 border-t border-border/50">
        {task.associatedPR && task.associatedPR.state === 'open' && (
          <ActionButton
            onClick={() => taskActions.closePR()}
            icon={XCircle}
            label="Close PR"
            variant="ghost"
            isPending={taskActions.isPending}
            confirmMessage={`Close PR #${task.associatedPR?.number}? This will NOT delete the branch.`}
          />
        )}
        <ActionButton
          onClick={() => (task.state === 'open' ? taskActions.close() : taskActions.reopen())}
          icon={task.state === 'open' ? XCircle : RotateCcw}
          label={
            task.state === 'open'
              ? taskActions.pendingAction === 'close'
                ? 'Closing…'
                : 'Close Issue'
              : taskActions.pendingAction === 'reopen'
                ? 'Reopening…'
                : 'Reopen Issue'
          }
          variant="ghost"
          isPending={
            taskActions.pendingAction === 'close' || taskActions.pendingAction === 'reopen'
          }
          disabled={taskActions.isPending}
        />
        {(task.column === 'done' || task.column === 'failed' || task.associatedPR) &&
          task.state === 'open' && (
            <ActionButton
              onClick={() => taskActions.reset()}
              icon={RotateCcw}
              label={taskActions.pendingAction === 'reset' ? 'Resetting…' : 'Reset & Re-run'}
              variant="ghost"
              isPending={taskActions.pendingAction === 'reset'}
              disabled={taskActions.isPending}
              confirmMessage="This will delete the branch, close the PR, remove all agent labels, and re-run the pipeline from scratch. Continue?"
            />
          )}
      </div>
    </div>
  )

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
            className="w-full h-20 px-3 py-2 text-sm bg-background border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
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

  // --- Tab Configuration ---
  const tabs = [
    ...(hasDescription
      ? [{ key: 'description' as const, label: 'Description', icon: FileText }]
      : []),
    { key: 'comments' as const, label: 'Comments', icon: MessageSquare, count: commentsCount },
    { key: 'changes' as const, label: 'Changes', icon: GitBranch },
    { key: 'docs' as const, label: 'Docs', icon: BookOpen },
  ]

  // --- Tab Bar ---
  const tabBar = (
    <div className="flex border-b border-border shrink-0 overflow-x-auto">
      {tabs.map(({ key, label, icon, count }) => (
        <TabButton
          key={key}
          active={activeTab === key}
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
      {activeTab === 'description' && hasDescription && (
        <div className="p-5 md:p-6 overflow-y-auto h-full">
          <div className="max-w-3xl">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {task.body!}
            </ReactMarkdown>
          </div>
        </div>
      )}
      {activeTab === 'comments' && (
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
      {(activeTab === 'changes' || activeTab === 'docs') && (
        <div className="p-4 overflow-y-auto h-full">
          <TaskPreviewTab task={task} activeTab={activeTab as 'changes' | 'docs'} />
        </div>
      )}
    </>
  )

  // --- Header ---
  const header = (
    <>
      {/* Colored accent bar */}
      <div className={`h-1.5 ${columnColors[task.column].bar} shrink-0`} />

      {/* Header content */}
      <div className="px-4 md:px-5 pt-3 md:pt-4 pb-3 border-b border-border bg-gradient-to-b from-background to-muted/20">
        {/* Top row: Status + Issue # + Timestamp + Actions */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge column={task.column} pipelineState={task.pipeline?.state} />
            <a
              href={getGitHubIssueUrl(task.issueNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-blue-400 flex items-center gap-1"
            >
              <Link2 className="w-3 h-3" />#{task.issueNumber}
            </a>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(task.updatedAt)}
            </span>
          </div>

          {/* Action buttons */}
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

        {/* Title - Prominent */}
        <h2 className="text-base md:text-lg font-semibold text-foreground leading-snug pr-8">
          {task.title}
        </h2>

        {/* Sub-status badges */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {task.column === 'gate-waiting' && task.gateType === 'hard-stop' && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> HARD STOP
            </Badge>
          )}
          {task.isTimeout && (
            <Badge
              variant="outline"
              className="border-orange-500/50 text-orange-400 text-[10px] px-1.5 py-0"
            >
              ⏰ TIMEOUT
            </Badge>
          )}
          {task.isExhausted && (
            <Badge
              variant="outline"
              className="border-orange-500/50 text-orange-400 text-[10px] px-1.5 py-0"
            >
              EXHAUSTED
            </Badge>
          )}
          {task.isSupervisorError && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              ERROR
            </Badge>
          )}
          {task.clarifyWaiting && (
            <Badge
              variant="outline"
              className="border-blue-500/50 text-blue-400 text-[10px] px-1.5 py-0"
            >
              💬 NEEDS ANSWER
            </Badge>
          )}
        </div>
      </div>
    </>
  )

  // --- Desktop Layout ---
  const desktopLayout = (
    <div className="hidden md:flex flex-1 min-h-0 overflow-hidden">
      {/* Left sidebar with improved visual grouping */}
      <div className="w-72 shrink-0 border-r border-border overflow-y-auto bg-muted/5">
        <div className="p-4 space-y-4">
          {/* Links Section */}
          <SidebarSection title="Links" icon={Link2}>
            {quickLinks}
          </SidebarSection>

          {/* Labels Section */}
          {task.labels.length > 0 && (
            <SidebarSection title="Labels" icon={TagIcon}>
              <div className="flex flex-wrap gap-1">
                {task.labels.map((label) => (
                  <Badge key={label} variant="outline" className="text-[11px] font-normal">
                    {label}
                  </Badge>
                ))}
              </div>
            </SidebarSection>
          )}

          {/* Assignees Section */}
          <SidebarSection title="Assignees" icon={UserIcon}>
            <AssigneePicker
              issueNumber={task.issueNumber}
              currentAssignees={fullDetails?.assignees || []}
              onChange={(event: AssigneeChangeEvent) => {
                // Optimistic update
                const current = fullDetails?.assignees || []
                if (event.action === 'assign') {
                  setAssigneeOverride([
                    ...current,
                    { login: event.login, avatar_url: event.avatar_url },
                  ])
                } else {
                  setAssigneeOverride(current.filter((a) => a.login !== event.login))
                }
                // Invalidate queries for eventual consistency
                queryClient.invalidateQueries({
                  queryKey: queryKeys.taskDetails(task.issueNumber),
                })
                queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
                onRefresh?.()
              }}
            />
          </SidebarSection>

          {/* Pipeline Section */}
          {task.pipeline && (
            <SidebarSection title="Pipeline" icon={GitBranch}>
              <PipelineStatus status={task.pipeline} />
            </SidebarSection>
          )}

          {/* Actions Section */}
          <SidebarSection title="Actions" icon={Zap}>
            {actionButtons}
          </SidebarSection>
        </div>
      </div>

      {/* Right content - tabs */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {tabBar}
        <div className="flex-1 min-h-0 overflow-hidden">{tabContent}</div>
      </div>
    </div>
  )

  // --- Mobile Layout ---
  const mobileLayout = (
    <div className="md:hidden flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Mobile top section */}
      <div className="shrink-0 px-3 py-3 border-b border-border space-y-3">
        {/* Quick links */}
        {quickLinks}

        {/* Info toggle */}
        <button
          onClick={() => setShowMobileInfo(!showMobileInfo)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
        >
          <Info className="w-3.5 h-3.5" />
          <span>{showMobileInfo ? 'Hide details' : 'Show details'}</span>
          {showMobileInfo ? (
            <ChevronUp className="w-3.5 h-3.5 ml-auto" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 ml-auto" />
          )}
        </button>

        {showMobileInfo && (
          <div className="space-y-3 pb-2">
            {/* Labels */}
            {task.labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.labels.map((label) => (
                  <Badge key={label} variant="outline" className="text-[10px] font-normal">
                    {label}
                  </Badge>
                ))}
              </div>
            )}

            {/* Assignees */}
            <div className="flex items-center gap-2">
              {fullDetails?.assignees && fullDetails.assignees.length > 0 ? (
                fullDetails.assignees.map((assignee) => (
                  <div
                    key={assignee.login}
                    className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded"
                  >
                    <Avatar className="h-3.5 w-3.5">
                      <AvatarImage src={assignee.avatar_url} alt={assignee.login} />
                      <AvatarFallback className="text-[9px]">
                        {assignee.login[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[11px]">{assignee.login}</span>
                  </div>
                ))
              ) : (
                <span className="text-[11px] text-muted-foreground italic">Unassigned</span>
              )}
            </div>

            {/* Pipeline */}
            {task.pipeline && <PipelineStatus status={task.pipeline} />}

            {/* Actions */}
            <div className="pt-2 border-t border-border">{actionButtons}</div>
          </div>
        )}
      </div>

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
