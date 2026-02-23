/**
 * @fileType component
 * @domain cody
 * @pattern kanban-card
 * @ai-summary Kanban card for a single task using design system
 */
'use client'

import { cn, formatRelativeTime } from '../utils'
import type { CodyTask } from '../types'
import { Badge } from '@/ui/web/components/badge'

interface KanbanCardProps {
  task: CodyTask
  onClick?: () => void
  selected?: boolean
}

export function KanbanCard({ task, onClick, selected }: KanbanCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 rounded-lg border cursor-pointer transition-all bg-card',
        'border-border hover:border-input',
        selected && 'border-primary ring-2 ring-primary/20',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-muted-foreground font-mono">{task.id}</span>
        {task.pipeline && (
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
        )}
      </div>

      <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-2">{task.title}</h3>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">#{task.issueNumber}</span>
        <span className="text-xs text-muted-foreground">{formatRelativeTime(task.updatedAt)}</span>
      </div>

      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.labels.slice(0, 3).map((label) => (
            <Badge key={label} variant="outline" className="text-xs">
              {label}
            </Badge>
          ))}
          {task.labels.length > 3 && (
            <span className="text-xs text-muted-foreground">+{task.labels.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}
