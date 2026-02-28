/**
 * @fileType component
 * @domain cody
 * @pattern task-detail
 * @ai-summary Task detail panel with TanStack Query hooks
 */
'use client'

import { useState } from 'react'
import { formatRelativeTime } from '../utils'
import type { CodyTask, GitHubComment } from '../types'
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
  Tag,
  User,
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

export function TaskDetail({ task, onClose, onRefresh }: TaskDetailProps) {
  const {
    data: details,
    refetch,
    isLoading: isDetailsLoading,
  } = useTaskDetails(task?.issueNumber ?? null)

  const [activeTab, setActiveTab] = useState<'comments' | 'changes' | 'docs'>('comments')
  const [retryContext, setRetryContext] = useState('')
  const [showRetryContext, setShowRetryContext] = useState(false)

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

  // Build full details only if we have task data
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

  return (
    <div className="h-full flex flex-col bg-card rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div>
          <span className="text-xs font-mono text-muted-foreground">{task.id}</span>
          <h2 className="text-lg font-semibold text-foreground mt-1">{task.title}</h2>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>

      {/* Compact Info Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Top row: Status + Issue number + Time */}
        <div className="flex items-center gap-3 mb-4">
          {/* Status badge */}
          {task.pipeline ? (
            <Badge
              variant={
                task.pipeline.state === 'completed'
                  ? 'default'
                  : task.pipeline.state === 'failed'
                    ? 'destructive'
                    : 'secondary'
              }
              className="flex items-center gap-1"
            >
              {task.pipeline.state === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
              {task.pipeline.state === 'completed' && <CheckCircle className="w-3 h-3" />}
              {task.pipeline.state === 'failed' && <XCircle className="w-3 h-3" />}
              {task.pipeline.state}
            </Badge>
          ) : (
            <Badge variant="outline">No pipeline</Badge>
          )}

          <span className="text-muted-foreground">•</span>

          <span className="text-sm font-mono text-muted-foreground">#{task.issueNumber}</span>

          <span className="text-muted-foreground">•</span>

          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(task.updatedAt)}
          </span>
        </div>

        {/* Sub-status badges row */}
        <div className="flex flex-wrap gap-1 mb-4">
          {task.column === 'gate-waiting' && task.gateType === 'hard-stop' && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> HARD STOP
            </Badge>
          )}
          {task.isTimeout && (
            <Badge
              variant="outline"
              className="border-orange-500 text-orange-500 flex items-center gap-1"
            >
              ⏰ TIMEOUT
            </Badge>
          )}
          {task.isExhausted && (
            <Badge
              variant="outline"
              className="border-orange-500 text-orange-500 flex items-center gap-1"
            >
              🔄 EXHAUSTED
            </Badge>
          )}
          {task.isSupervisorError && (
            <Badge variant="destructive" className="flex items-center gap-1">
              ⚠️ ERROR
            </Badge>
          )}
          {task.clarifyWaiting && (
            <Badge
              variant="outline"
              className="border-blue-500 text-blue-500 flex items-center gap-1"
            >
              💬 NEEDS ANSWER
            </Badge>
          )}
        </div>

        {/* Quick links row */}
        <div className="flex flex-wrap gap-2 mb-4">
          {task.associatedPR && (
            <a
              href={task.associatedPR.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
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
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
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
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            >
              <Play className="w-3 h-3" />
              Workflow
            </a>
          )}
        </div>

        {/* Labels row */}
        {task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
            {task.labels.map((label) => (
              <Badge key={label} variant="outline" className="text-xs">
                {label}
              </Badge>
            ))}
          </div>
        )}

        {/* Assignees row */}
        <div className="flex items-center gap-2 mb-4">
          <User className="w-3 h-3 text-muted-foreground shrink-0" />
          {fullDetails?.assignees && fullDetails.assignees.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {fullDetails.assignees.map((assignee) => (
                <div
                  key={assignee.login}
                  className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full"
                >
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={assignee.avatar_url} alt={assignee.login} />
                    <AvatarFallback className="text-[10px]">
                      {assignee.login[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs">{assignee.login}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Unassigned</span>
          )}
        </div>

        {/* Pipeline status */}
        {task.pipeline && (
          <div className="mb-4">
            <PipelineStatus status={task.pipeline} />
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-border mb-4 gap-4">
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'comments'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Comments
          </button>
          <button
            onClick={() => setActiveTab('changes')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'changes'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Changes
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'docs'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Docs
          </button>
        </div>

        {activeTab === 'comments' && (
          <div className="flex-1 flex flex-col min-h-[400px] mt-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2 shrink-0">
              Comments
            </h3>
            <div className="flex-1 overflow-y-auto min-h-0">
              <CommentList comments={fullDetails?.comments || []} loading={isDetailsLoading} />
            </div>
            <div className="shrink-0 mt-2">
              <CommentEditor issueNumber={task.issueNumber} onCommentPosted={() => refetch()} />
            </div>

            {/* Retry with Context — visible for failed tasks */}
            {task.column === 'failed' && (
              <div className="shrink-0 mt-3 border border-orange-500/30 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowRetryContext(!showRetryContext)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-orange-500/10 hover:bg-orange-500/15 transition-colors"
                >
                  <span className="text-sm font-medium text-orange-400 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Retry with Context
                  </span>
                  {showRetryContext ? (
                    <ChevronUp className="w-4 h-4 text-orange-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-orange-400" />
                  )}
                </button>
                {showRetryContext && (
                  <div className="p-3 space-y-2">
                    <textarea
                      value={retryContext}
                      onChange={(e) => setRetryContext(e.target.value)}
                      placeholder="Add context for the retry (e.g., hints about the fix, error details, instructions)..."
                      className="w-full h-24 px-3 py-2 text-sm bg-background border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 placeholder:text-muted-foreground"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Posts <code className="text-orange-400">@cody retry</code> + your context,
                        then triggers execution
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                        onClick={() => retryWithContext.mutate(retryContext)}
                        disabled={retryWithContext.isPending}
                      >
                        {retryWithContext.isPending ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-1" />
                        )}
                        {retryWithContext.isPending ? 'Retrying...' : 'Retry'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {(activeTab === 'changes' || activeTab === 'docs') && (
          <div className="flex-1 min-h-0">
            <TaskPreviewTab task={task} activeTab={activeTab as 'changes' | 'docs'} />
          </div>
        )}

        {/* Action Panel */}
        <div className="p-3 border-t border-border bg-muted/20">
          <div className="flex flex-wrap gap-2 justify-center">
            {/* Run / Execute with Cody - for open unassigned tasks */}
            {task.state === 'open' &&
              (!fullDetails?.assignees || fullDetails.assignees.length === 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
                  onClick={() => taskActions.execute()}
                  disabled={taskActions.isPending}
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Run
                </Button>
              )}

            {/* Stop / Abort - for running tasks */}
            {task.pipeline?.state === 'running' && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                onClick={() => taskActions.abort()}
                disabled={taskActions.isPending}
              >
                <Ban className="w-4 h-4 mr-1" />
                Stop
              </Button>
            )}

            {/* Approve Gate - for gate-waiting tasks */}
            {task.column === 'gate-waiting' && (
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={() => {
                  // Post approve comment
                  fetch(`/api/cody/tasks/issue-${task.issueNumber}/actions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'approve' }),
                  }).then(() => {
                    onRefresh?.()
                    refetch()
                  })
                }}
              >
                <ShieldCheck className="w-4 h-4 mr-1" />
                Approve
              </Button>
            )}

            {/* Reject Gate */}
            {task.column === 'gate-waiting' && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                onClick={() => {
                  fetch(`/api/cody/tasks/issue-${task.issueNumber}/actions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'reject' }),
                  }).then(() => {
                    onRefresh?.()
                    refetch()
                  })
                }}
              >
                <ShieldX className="w-4 h-4 mr-1" />
                Reject
              </Button>
            )}

            {/* Retry - for failed tasks */}
            {task.column === 'failed' && (
              <Button
                variant="outline"
                size="sm"
                className="text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                onClick={() => taskActions.execute()}
                disabled={taskActions.isPending}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Retry
              </Button>
            )}

            {/* Close / Reopen task */}
            <Button
              variant="outline"
              size="sm"
              className="text-zinc-400 border-zinc-500/30"
              onClick={() => {
                if (task.state === 'open') {
                  taskActions.close()
                } else {
                  taskActions.reopen()
                }
              }}
              disabled={taskActions.isPending}
            >
              {task.state === 'open' ? (
                <>
                  <XCircle className="w-4 h-4 mr-1" />
                  Close
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reopen
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
