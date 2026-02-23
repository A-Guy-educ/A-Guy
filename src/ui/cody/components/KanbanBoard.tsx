/**
 * @fileType component
 * @domain cody
 * @pattern kanban-board
 * @ai-summary Main kanban board component
 */
'use client'

import { useState, useCallback } from 'react'
import type { CodyTask, Board, ColumnId } from '../types'
import { COLUMN_DEFS } from '../constants'
import { KanbanColumn } from './KanbanColumn'
import { BoardSwitcher } from './BoardSwitcher'

interface KanbanBoardProps {
  tasks: CodyTask[]
  boards: Board[]
  selectedTask?: CodyTask | null
  onTaskSelect?: (task: CodyTask | null) => void
  onExecuteTask?: (taskId: string) => void
}

export function KanbanBoard({
  tasks,
  boards,
  selectedTask,
  onTaskSelect,
  onExecuteTask,
}: KanbanBoardProps) {
  const [currentBoard, setCurrentBoard] = useState('all')

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
    ['open', 'building', 'review', 'done', 'failed', 'gate-waiting', 'retrying'] as ColumnId[]
  ).filter(
    (col) =>
      tasksByColumn[col]?.length > 0 || col === 'open' || col === 'building' || col === 'done',
  )

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
      {/* Board Switcher */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <BoardSwitcher
          boards={boards}
          currentBoard={currentBoard}
          onBoardChange={setCurrentBoard}
        />
      </div>

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
