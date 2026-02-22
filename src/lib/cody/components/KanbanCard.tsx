/**
 * @fileType component
 * @domain cody
 * @pattern kanban-card
 * @ai-summary Kanban card for a single task
 */
'use client'

import { cn, formatRelativeTime } from '../utils'
import type { CodyTask } from '../types'
import { StatusBadge } from './StatusBadge'

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
        'p-3 rounded-lg border cursor-pointer transition-all',
        'bg-gray-800 border-gray-700 hover:border-gray-600',
        selected && 'border-blue-500 ring-2 ring-blue-500/20',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-gray-400 font-mono">{task.id}</span>
        {task.pipeline && <StatusBadge status={task.pipeline.state} />}
      </div>

      <h3 className="text-sm font-medium text-white line-clamp-2 mb-2">{task.title}</h3>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">#{task.issueNumber}</span>
        <span className="text-xs text-gray-500">{formatRelativeTime(task.updatedAt)}</span>
      </div>

      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.labels.slice(0, 3).map((label) => (
            <span key={label} className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
              {label}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="text-xs text-gray-500">+{task.labels.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}
