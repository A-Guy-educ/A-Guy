/**
 * @fileType component
 * @domain cody
 * @pattern task-detail
 * @ai-summary Task detail panel with pipeline, actions, comments, assignees, and labels
 */
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '../utils'
import type { CodyTask, GitHubComment } from '../types'
import { PipelineStatus } from './PipelineStatus'
import { CommentEditor } from './CommentEditor'
import { CommentList } from './CommentList'
import { AssigneePicker } from './AssigneePicker'
import { LabelPicker } from './LabelPicker'
import { Button } from '@/ui/web/components/button'
import { Badge } from '@/ui/web/components/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/web/components/avatar'

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
  const [fullDetails, setFullDetails] = useState<FullTaskDetails | null>(null)

  const fetchDetails = async () => {
    if (!task) return
    try {
      const res = await fetch(`/api/cody/tasks/issue-${task.issueNumber}`)
      const data = await res.json()
      setFullDetails({
        ...task,
        assignees: data.task?.assignees || [],
        comments: data.comments || [],
      })
    } catch (err) {
      console.error('Failed to fetch task details:', err)
    }
  }

  useEffect(() => {
    fetchDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task])

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>Select a task to view details</p>
      </div>
    )
  }

  const handleStateChange = async (newState: 'open' | 'closed') => {
    try {
      const res = await fetch(`/api/cody/tasks/issue-${task.issueNumber}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: newState === 'closed' ? 'close' : 'reopen',
        }),
      })

      if (res.ok) {
        onRefresh?.()
      }
    } catch (err) {
      console.error('Failed to change state:', err)
    }
  }

  const handleAbort = async () => {
    try {
      const res = await fetch(`/api/cody/tasks/issue-${task.issueNumber}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'abort' }),
      })

      if (res.ok) {
        onRefresh?.()
      }
    } catch (err) {
      console.error('Failed to abort:', err)
    }
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Status */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Status</h3>
          {task.pipeline ? (
            <Badge
              variant={
                task.pipeline.state === 'completed'
                  ? 'default'
                  : task.pipeline.state === 'failed'
                    ? 'destructive'
                    : 'secondary'
              }
            >
              {task.pipeline.state}
            </Badge>
          ) : (
            <span className="text-muted-foreground">No pipeline data</span>
          )}
        </div>

        {/* Pipeline */}
        {task.pipeline && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Pipeline</h3>
            <PipelineStatus status={task.pipeline} />
          </div>
        )}

        {/* Issue Info */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Issue</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Number:</span>
              <span className="text-foreground">#{task.issueNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">State:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStateChange(task.state === 'open' ? 'closed' : 'open')}
              >
                {task.state === 'open' ? 'Close' : 'Reopen'}
              </Button>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated:</span>
              <span className="text-foreground">{formatRelativeTime(task.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Assignees */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">Assignees</h3>
            <AssigneePicker
              issueNumber={task.issueNumber}
              currentAssignees={fullDetails?.assignees || []}
              onChange={onRefresh}
            />
          </div>
          {fullDetails?.assignees && fullDetails.assignees.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {fullDetails.assignees.map((assignee) => (
                <div
                  key={assignee.login}
                  className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={assignee.avatar_url} alt={assignee.login} />
                    <AvatarFallback>{assignee.login[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs">{assignee.login}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">No assignees</span>
          )}
        </div>

        {/* Labels */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">Labels</h3>
            <LabelPicker
              issueNumber={task.issueNumber}
              currentLabels={task.labels.map((name) => ({ name, color: '000000' }))}
              onChange={onRefresh}
            />
          </div>
          {task.labels.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {task.labels.map((label) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">No labels</span>
          )}
        </div>

        {/* Workflow Run */}
        {task.workflowRun && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Workflow</h3>
            <a
              href={task.workflowRun.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:text-primary/80"
            >
              View Run →
            </a>
          </div>
        )}

        {/* Associated PR */}
        {task.associatedPR && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              Pull Request
            </h3>
            <a
              href={task.associatedPR.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:text-primary/80"
            >
              #{task.associatedPR.number}: {task.associatedPR.title} →
            </a>
          </div>
        )}

        {/* Comments Section */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Comments</h3>
          <CommentEditor
            issueNumber={task.issueNumber}
            onCommentPosted={() => {
              // Refresh the task details to get new comments
              fetchDetails()
            }}
          />
          <div className="mt-4">
            <CommentList comments={fullDetails?.comments || []} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <Button className="w-full" asChild>
          <Link
            href={`https://github.com/A-Guy-educ/A-Guy/issues/${task.issueNumber}`}
            target="_blank"
          >
            View on GitHub
          </Link>
        </Button>
        {task.pipeline?.state === 'running' && (
          <Button variant="destructive" className="w-full" onClick={handleAbort}>
            Abort Run
          </Button>
        )}
      </div>
    </div>
  )
}
