/**
 * @fileType component
 * @domain cody
 * @pattern kanban-column
 * @ai-summary Kanban column showing tasks in a stage using design system
 */
'use client'

import { cn } from '../utils'
import type { CodyTask, ColumnId } from '../types'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnProps {
  id: ColumnId
  title: string
  tasks: CodyTask[]
  onTaskClick?: (task: CodyTask) => void
  selectedTaskId?: string
  onExecuteTask?: (taskId: string) => void
}

const columnColors: Record<ColumnId, string> = {
  open: 'border-muted-foreground',
  building: 'border-blue-500',
  review: 'border-purple-500',
  done: 'border-green-500',
  failed: 'border-destructive',
  'gate-waiting': 'border-yellow-500',
  retrying: 'border-orange-500',
}

export function KanbanColumn({
  id,
  title,
  tasks,
  onTaskClick,
  selectedTaskId,
  onExecuteTask,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px]">
      <div
        className={cn('flex items-center justify-between px-3 py-2 border-t-2', columnColors[id])}
      >
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="px-2 py-0.5 text-xs bg-secondary text-secondary-foreground rounded-full">
          {tasks.length}
        </span>
      </div>

      <div className="flex-1 p-2 space-y-2 bg-muted/30 rounded-b-lg overflow-y-auto max-h-[calc(100vh-200px)]">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No tasks</p>
        ) : (
          tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
              selected={task.id === selectedTaskId}
              onExecute={onExecuteTask}
            />
          ))
        )}
      </div>
    </div>
  )
}
