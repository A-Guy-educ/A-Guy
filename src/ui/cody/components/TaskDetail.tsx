/**
 * @fileType component
 * @domain cody
 * @pattern task-detail
 * @ai-summary Task detail — two-column on desktop, single-column on mobile, with rich description + actions
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
import { Button } from '@/ui/web/components/button'
import { Badge } from '@/ui/web/components/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/web/components/avatar'
import { useTaskActions, useTaskDetails, useRetryWithContext } from '../hooks'
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
} from 'lucide-react'

interface TaskDetailProps {
  task: CodyTask | null
  onClose?: () => void
  onRefresh?: () => void
}

interface FullTaskDetails extends CodyTask {
  assignees: Array<{ login: string; avatar_url: string }>
  comments: GitHubComment[]
}

const columnColors: Record<ColumnId, { bg: string; text: string; bar: string }> = {
  open: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', bar: 'bg-zinc-400' },
  building: { bg: 'bg-blue-500/10', text: 'text-blue-400', bar: 'bg-blue-500' },
  review: { bg: 'bg-purple-500/10', text: 'text-purple-400', bar: 'bg-purple-500' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-400', bar: 'bg-red-500' },
  'gate-waiting': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', bar: 'bg-yellow-500' },
  retrying: { bg: 'bg-orange-500/10', text: 'text-orange-400', bar: 'bg-orange-500' },
  done: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', bar: 'bg-emerald-500' },
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

export function TaskDetail({ task, onClose, onRefresh }: TaskDetailProps) {
  const {
    data: details,
    refetch,
    isFetching: isDetailsFetching,
  } = useTaskDetails(task?.issueNumber ?? null)

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
    // Ensure spinner is visible for at least 600ms
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    refreshTimeoutRef.current = setTimeout(() => setIsRefreshing(false), 600)
  }, [refetch, onRefresh])

  // Clean up timeout on unmount
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
    onSuccess: () => {
      setRetryContext('')
      setShowRetryContext(false)
      onRefresh?.()
      refetch()
    },
  })

  const taskActions = useTaskActions({
    issueNumber: task?.issueNumber ?? 0,
    onSuccess: () => {
      onRefresh?.()
      refetch()
    },
  })

  const fullDetails: FullTaskDetails | null = (() => {
    if (!details?.task || !task) return null
    return {
      ...task,
      assignees: details.task.assignees || [],
      comments: (details.comments as GitHubComment[]) || [],
    }
  })()

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>Select a task to view details</p>
      </div>
    )
  }

  const colors = columnColors[task.column]
  const hasDescription = task.body && task.body.trim().length > 0

  // --- Shared sub-components ---

  // Reusable markdown component config for description rendering
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

  const quickLinksRow = (
    <div className="flex flex-wrap gap-1.5">
      <a
        href={getGitHubIssueUrl(task.issueNumber)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Github className="w-3 h-3" />
        Issue
      </a>
      {task.associatedPR && (
        <a
          href={task.associatedPR.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
        >
          <GitPullRequest className="w-3 h-3" />
          PR #{task.associatedPR.number}
        </a>
      )}
      {task.previewUrl && (
        <a
          href={task.previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Preview
        </a>
      )}
      {task.workflowRun && (
        <a
          href={task.workflowRun.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Play className="w-3 h-3" />
          Workflow
        </a>
      )}
    </div>
  )

  const actionButtons = (
    <div className="space-y-1.5">
      {/* Run */}
      {task.state === 'open' && (!fullDetails?.assignees || fullDetails.assignees.length === 0) && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-blue-400 border-blue-500/20 hover:bg-blue-500/10"
          onClick={() => taskActions.execute()}
          disabled={taskActions.isPending}
        >
          {taskActions.pendingAction === 'execute' ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5 mr-1.5" />
          )}
          {taskActions.pendingAction === 'execute' ? 'Starting…' : 'Run Task'}
        </Button>
      )}

      {/* Stop */}
      {task.pipeline?.state === 'running' && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-red-400 border-red-500/20 hover:bg-red-500/10"
          onClick={() => taskActions.abort()}
          disabled={taskActions.isPending}
        >
          {taskActions.pendingAction === 'abort' ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Ban className="w-3.5 h-3.5 mr-1.5" />
          )}
          {taskActions.pendingAction === 'abort' ? 'Stopping…' : 'Stop'}
        </Button>
      )}

      {/* Approve Gate */}
      {task.column === 'gate-waiting' && !completedActions.has('approve') && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
          onClick={() => {
            setCompletedActions((prev) => new Set([...prev, 'approve']))
            taskActions.approveGate()
          }}
          disabled={taskActions.isPending}
        >
          {taskActions.pendingAction === 'approve' ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
          )}
          {taskActions.pendingAction === 'approve' ? 'Approving…' : 'Approve Gate'}
        </Button>
      )}

      {/* Pending approval indicator */}
      {task.column === 'gate-waiting' &&
        completedActions.has('approve') &&
        !taskActions.isPending && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 px-3 py-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Awaiting pipeline…
          </div>
        )}

      {/* Reject Gate */}
      {task.column === 'gate-waiting' && !completedActions.has('reject') && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-red-400 border-red-500/20 hover:bg-red-500/10"
          onClick={() => {
            setCompletedActions((prev) => new Set([...prev, 'reject']))
            taskActions.rejectGate()
          }}
          disabled={taskActions.isPending}
        >
          {taskActions.pendingAction === 'reject' ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <ShieldX className="w-3.5 h-3.5 mr-1.5" />
          )}
          {taskActions.pendingAction === 'reject' ? 'Rejecting…' : 'Reject Gate'}
        </Button>
      )}

      {/* Retry */}
      {task.column === 'failed' && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-orange-400 border-orange-500/20 hover:bg-orange-500/10"
          onClick={() => taskActions.execute()}
          disabled={taskActions.isPending}
        >
          {taskActions.pendingAction === 'execute' ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          )}
          {taskActions.pendingAction === 'execute' ? 'Retrying…' : 'Retry'}
        </Button>
      )}

      {/* Close PR */}
      {task.associatedPR && task.associatedPR.state === 'open' && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={() => {
            if (
              confirm(`Close PR #${task.associatedPR?.number}? This will NOT delete the branch.`)
            ) {
              taskActions.closePR()
            }
          }}
          disabled={taskActions.isPending}
        >
          <XCircle className="w-3 h-3 mr-1.5" />
          Close PR
        </Button>
      )}

      {/* Close / Reopen */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground hover:text-foreground"
        onClick={() => {
          if (task.state === 'open') taskActions.close()
          else taskActions.reopen()
        }}
        disabled={taskActions.isPending}
      >
        {task.state === 'open' ? (
          <>
            {taskActions.pendingAction === 'close' ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
            )}
            {taskActions.pendingAction === 'close' ? 'Closing…' : 'Close Issue'}
          </>
        ) : (
          <>
            {taskActions.pendingAction === 'reopen' ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            )}
            {taskActions.pendingAction === 'reopen' ? 'Reopening…' : 'Reopen Issue'}
          </>
        )}
      </Button>

      {/* Reset */}
      {(task.column === 'done' || task.column === 'failed' || task.associatedPR) &&
        task.state === 'open' && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-blue-400 hover:bg-blue-500/10"
            onClick={() => {
              if (
                confirm(
                  'This will delete the branch, close the PR, remove all agent labels, and re-run the pipeline from scratch. Continue?',
                )
              ) {
                taskActions.reset()
              }
            }}
            disabled={taskActions.isPending}
          >
            {taskActions.pendingAction === 'reset' ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            )}
            {taskActions.pendingAction === 'reset' ? 'Resetting…' : 'Reset & Re-run'}
          </Button>
        )}
    </div>
  )

  const retryWithContextBlock = task.column === 'failed' && (
    <div className="border-t border-orange-500/20 bg-orange-500/5">
      <button
        onClick={() => setShowRetryContext(!showRetryContext)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-orange-500/10 transition-colors"
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

  const tabs = [
    ...(hasDescription ? [{ key: 'description' as const, label: 'Description' }] : []),
    { key: 'comments' as const, label: 'Comments' },
    { key: 'changes' as const, label: 'Changes' },
    { key: 'docs' as const, label: 'Docs' },
  ]

  const tabBar = (
    <div className="flex border-b border-border shrink-0">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )

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

  // ===== HEADER (shared between mobile/desktop) =====
  const header = (
    <>
      {/* Accent bar */}
      <div className={`h-1 ${colors.bar} shrink-0`} />

      {/* Header content */}
      <div className="flex items-start justify-between px-4 md:px-5 pt-3 md:pt-4 pb-2 md:pb-3 border-b border-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className={`${colors.bg} ${colors.text} border-0 text-xs font-semibold`}>
              {task.pipeline?.state === 'running' && (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              )}
              {task.pipeline?.state === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
              {task.pipeline?.state === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
              {columnLabels[task.column]}
            </Badge>
            <a
              href={getGitHubIssueUrl(task.issueNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-muted-foreground hover:text-blue-400 hover:underline"
            >
              #{task.issueNumber}
            </a>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(task.updatedAt)}
            </span>

            {/* Sub-status badges */}
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
          <h2 className="text-sm md:text-base font-semibold text-foreground leading-snug">
            {task.title}
          </h2>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
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
    </>
  )

  // ===== DESKTOP LAYOUT =====
  const desktopLayout = (
    <div className="hidden md:flex flex-1 min-h-0 overflow-hidden">
      {/* Left sidebar */}
      <div className="w-72 shrink-0 border-r border-border overflow-y-auto">
        <div className="p-4 space-y-4">
          <div>
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Links
            </h4>
            {quickLinksRow}
          </div>

          {task.labels.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Labels
              </h4>
              <div className="flex flex-wrap gap-1">
                {task.labels.map((label) => (
                  <Badge key={label} variant="outline" className="text-[11px] font-normal">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Assignees
            </h4>
            {fullDetails?.assignees && fullDetails.assignees.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {fullDetails.assignees.map((assignee) => (
                  <div
                    key={assignee.login}
                    className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md"
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={assignee.avatar_url} alt={assignee.login} />
                      <AvatarFallback className="text-[10px]">
                        {assignee.login[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-foreground">{assignee.login}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">Unassigned</span>
            )}
          </div>

          {task.pipeline && (
            <div>
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Pipeline
              </h4>
              <PipelineStatus status={task.pipeline} />
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Actions
            </h4>
            {actionButtons}
          </div>
        </div>
      </div>

      {/* Right content — tabs */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {tabBar}
        <div className="flex-1 min-h-0 overflow-hidden">{tabContent}</div>
      </div>
    </div>
  )

  // ===== MOBILE LAYOUT =====
  const mobileLayout = (
    <div className="md:hidden flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Mobile top section: quick links + optional info toggle */}
      <div className="shrink-0 px-3 py-2 border-b border-border space-y-2">
        {/* Quick links */}
        {quickLinksRow}

        {/* Info toggle — shows description, labels, assignees, pipeline, actions */}
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
          <div className="space-y-3 pb-1">
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
    <div className="h-full flex flex-col bg-card rounded-lg overflow-hidden">
      {header}
      {desktopLayout}
      {mobileLayout}
    </div>
  )
}
