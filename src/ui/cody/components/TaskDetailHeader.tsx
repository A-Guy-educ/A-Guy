/**
 * @fileType component
 * @domain cody
 * @pattern task-detail-header
 * @ai-summary Task detail header with title, status badges, and quick actions
 */
'use client'

import { type MouseEvent } from 'react'
import type { CodyTask, ColumnId } from '../types'
import { getGitHubIssueUrl } from '../constants'
import { formatRelativeTime } from '../utils'
import { Button } from '@/ui/web/components/button'
import { Badge } from '@/ui/web/components/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/web/components/avatar'
import {
  GitPullRequest,
  ExternalLink,
  CheckCircle,
  XCircle,
  RefreshCw,
  Github,
  ArrowLeft,
  Eye,
  Pencil,
  Copy,
  ListPlus,
  ListMinus,
  Zap,
  ShieldCheck,
  RotateCcw,
  Ban,
} from 'lucide-react'
import { SimpleTooltip } from './SimpleTooltip'

interface TaskDetailHeaderProps {
  task: CodyTask
  /** Called when closing the detail view */
  onClose?: () => void
  /** Called when refreshing task */
  onRefresh?: () => void
  /** Called when opening preview */
  onOpenPreview?: () => void
  /** Called when editing task */
  onEditTask?: (task: CodyTask) => void
  /** Called when duplicating task */
  onDuplicate?: (task: CodyTask) => void
  /** Called when executing task */
  onExecute?: (task: CodyTask) => void
  /** Called when stopping task */
  onStop?: (task: CodyTask) => void
  /** Called when approving review */
  onApproveReview?: (task: CodyTask) => void
  /** Called when adding to queue */
  onAddToQueue?: (task: CodyTask) => void
  /** Called when removing from queue */
  onRemoveFromQueue?: (task: CodyTask) => void
  /** Whether task is currently executing */
  isExecuting?: boolean
  /** Whether task is merging */
  isMerging?: boolean
}

const columnColors: Record<ColumnId, { bg: string; text: string; pill: string }> = {
  open: {
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    pill: 'bg-zinc-500/20 text-zinc-300 ring-1 ring-zinc-400/30',
  },
  building: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    pill: 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/30',
  },
  review: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    pill: 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-400/30',
  },
  'gate-waiting': {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    pill: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30',
  },
  retrying: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    pill: 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-400/30',
  },
  failed: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    pill: 'bg-red-500/20 text-red-300 ring-1 ring-red-400/30',
  },
  done: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    pill: 'bg-green-500/20 text-green-300 ring-1 ring-green-400/30',
  },
}

const columnLabels: Record<ColumnId, string> = {
  open: 'Open',
  building: 'Building',
  review: 'Review',
  'gate-waiting': 'Gate Waiting',
  retrying: 'Retrying',
  failed: 'Failed',
  done: 'Done',
}

const columnIcons: Record<ColumnId, typeof Zap> = {
  open: Zap,
  building: RefreshCw,
  review: GitPullRequest,
  'gate-waiting': ShieldCheck,
  retrying: RotateCcw,
  failed: XCircle,
  done: CheckCircle,
}

/**
 * Task detail header - extracted from TaskDetail component
 * Contains title, status badge, assignees, and quick action buttons
 */
export function TaskDetailHeader({
  task,
  onClose,
  onRefresh,
  onOpenPreview,
  onEditTask,
  onDuplicate,
  onExecute,
  onStop,
  onApproveReview,
  onAddToQueue,
  onRemoveFromQueue,
  isExecuting = false,
  isMerging = false,
}: TaskDetailHeaderProps) {
  const colors = columnColors[task.column] || columnColors.open
  const ColumnIcon = columnIcons[task.column] || Zap
  const columnLabel = columnLabels[task.column] || 'Open'

  const isQueued = task.labels.includes('cody:queued')
  const hasPR = !!task.associatedPR

  const handleCopyLink = (e: MouseEvent) => {
    e.preventDefault()
    navigator.clipboard.writeText(getGitHubIssueUrl(task.issueNumber))
  }

  return (
    <div className="space-y-3">
      {/* Back button + Title + Column Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0 -ml-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold truncate">{task.title}</h2>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className={colors.pill}>
            <ColumnIcon className="w-3 h-3 mr-1" />
            {columnLabel}
          </Badge>
        </div>
      </div>

      {/* Issue number + Updated time + Actions */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <a
          href={getGitHubIssueUrl(task.issueNumber)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Github className="w-3.5 h-3.5" />#{task.issueNumber}
          <ExternalLink className="w-3 h-3" />
        </a>
        <span>•</span>
        <span>Updated {formatRelativeTime(task.updatedAt)}</span>

        <div className="flex items-center gap-1 ml-auto">
          <SimpleTooltip content="Copy issue link">
            <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={handleCopyLink}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </SimpleTooltip>
          <SimpleTooltip content="Refresh">
            <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={onRefresh}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </SimpleTooltip>
          {hasPR && (
            <SimpleTooltip content="Open PR preview">
              <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={onOpenPreview}>
                <Eye className="w-3.5 h-3.5" />
              </Button>
            </SimpleTooltip>
          )}
          <SimpleTooltip content="Edit">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5"
              onClick={() => onEditTask?.(task)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          </SimpleTooltip>
        </div>
      </div>

      {/* Assignees */}
      {task.assignees && task.assignees.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Assignees:</span>
          <div className="flex -space-x-2">
            {task.assignees.map((assignee) => (
              <Avatar key={assignee.login} className="w-6 h-6 border-2 border-background">
                <AvatarImage src={assignee.avatar_url} alt={assignee.login} />
                <AvatarFallback className="text-[10px]">
                  {assignee.login.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>
      )}

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels
            .filter((l) => !l.startsWith('cody:'))
            .map((label) => (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}
              </Badge>
            ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 pt-2">
        {/* Primary action based on column */}
        {task.column === 'open' && (
          <Button size="sm" onClick={() => onExecute?.(task)} disabled={isExecuting}>
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            {isExecuting ? 'Starting...' : 'Execute'}
          </Button>
        )}

        {(task.column === 'building' || task.column === 'gate-waiting') && (
          <Button variant="outline" size="sm" onClick={() => onStop?.(task)} disabled={isExecuting}>
            <Ban className="w-3.5 h-3.5 mr-1.5" />
            Stop
          </Button>
        )}

        {task.column === 'review' && (
          <Button size="sm" onClick={() => onApproveReview?.(task)} disabled={isMerging}>
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
            {isMerging ? 'Merging...' : 'Merge'}
          </Button>
        )}

        {/* Queue toggle */}
        {isQueued ? (
          <Button variant="outline" size="sm" onClick={() => onRemoveFromQueue?.(task)}>
            <ListMinus className="w-3.5 h-3.5 mr-1.5" />
            Remove from Queue
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => onAddToQueue?.(task)}>
            <ListPlus className="w-3.5 h-3.5 mr-1.5" />
            Add to Queue
          </Button>
        )}

        {/* Duplicate */}
        <Button variant="outline" size="sm" onClick={() => onDuplicate?.(task)}>
          <Copy className="w-3.5 h-3.5 mr-1.5" />
          Duplicate
        </Button>
      </div>
    </div>
  )
}
