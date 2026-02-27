/**
 * @fileType component
 * @domain cody
 * @pattern kanban-board
 * @ai-summary Main kanban board component
 */
'use client'

import { useCallback } from 'react'
import type { CodyTask, ColumnId } from '../types'
import { COLUMN_DEFS } from '../constants'
import { KanbanColumn } from './KanbanColumn'

interface KanbanBoardProps {
  tasks: CodyTask[]
  selectedTask?: CodyTask | null
  onTaskSelect?: (task: CodyTask | null) => void
  onExecuteTask?: (taskId: string) => void
}

export function KanbanBoard({
  tasks,
  selectedTask,
  onTaskSelect,
  onExecuteTask,
}: KanbanBoardProps) {
  // Group tasks by column
  const tasksByColumn = tasks.reduce(
    (acc, task) => {
      const column = task.column
      if (!acc[column]) acc[column] = []
      acc[column].push(task)
      return acc
    },
    {} as Record<ColumnId, CodyTask[]>,
  )

  // Get visible columns (columns that have tasks + always visible ones)
  const visibleColumns: ColumnId[] = (
    ['open', 'building', 'review', 'failed', 'gate-waiting', 'retrying'] as ColumnId[]
  ).filter((col) => tasksByColumn[col]?.length > 0 || col === 'open' || col === 'building')

  const handleTaskClick = useCallback(
    (task: CodyTask) => {
      if (onTaskSelect) {
        onTaskSelect(selectedTask?.id === task.id ? null : task)
      }
    },
    [onTaskSelect, selectedTask],
  )

  return (
    <div className="flex flex-col h-full">
      {/* Kanban Columns */}
      <div className="flex-1 flex gap-2 p-4 overflow-x-auto">
        {visibleColumns.map((columnId) => (
          <KanbanColumn
            key={columnId}
            id={columnId}
            title={COLUMN_DEFS[columnId]?.label || columnId}
            tasks={tasksByColumn[columnId] || []}
            onTaskClick={handleTaskClick}
            selectedTaskId={selectedTask?.id}
            onExecuteTask={onExecuteTask}
          />
        ))}
      </div>
    </div>
  )
}
