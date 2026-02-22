/**
 * @fileType component
 * @domain cody
 * @pattern cody-dashboard
 * @ai-summary Main dashboard component
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { CopilotChat } from '@copilotkit/react-ui'
import type { CodyTask, Board } from '../types'
import { KanbanBoard } from './KanbanBoard'
import { TaskDetail } from './TaskDetail'
import { CreateTaskDialog } from './CreateTaskDialog'

const API_BASE = '/api/cody'

export function CodyDashboard() {
  const [tasks, setTasks] = useState<CodyTask[]>([])
  const [boards, setBoards] = useState<Board[]>([])
  const [selectedTask, setSelectedTask] = useState<CodyTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Fetch boards
  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/boards`)
      if (!res.ok) throw new Error('Failed to fetch boards')
      const data = await res.json()
      setBoards(data.boards)
    } catch (err) {
      console.error('Error fetching boards:', err)
    }
  }, [])

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/tasks`)
      if (!res.ok) throw new Error('Failed to fetch tasks')
      const data = await res.json()
      setTasks(data.tasks)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchBoards()
    fetchTasks()
  }, [fetchBoards, fetchTasks])

  // Polling for updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTasks()
    }, 10000) // 10 second polling

    return () => clearInterval(interval)
  }, [fetchTasks])

  // Handle task creation
  const handleCreateTask = async (data: { title: string; body: string; mode: string }) => {
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create task')
      setShowCreateDialog(false)
      fetchTasks()
    } catch (err) {
      console.error('Error creating task:', err)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={fetchTasks}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h1 className="text-xl font-semibold text-white">Cody Operations</h1>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
          >
            + New Task
          </button>
        </div>

        {/* Board */}
        <div className="flex-1 overflow-hidden">
          {loading && tasks.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">Loading...</div>
            </div>
          ) : (
            <KanbanBoard
              tasks={tasks}
              boards={boards}
              selectedTask={selectedTask}
              onTaskSelect={setSelectedTask}
            />
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="w-96 border-l border-gray-700">
        <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
      </div>

      {/* Chat Panel */}
      <div className="w-80 border-l border-gray-700">
        <CopilotChat
          className="h-full"
          labels={{
            placeholder: 'Ask about Cody tasks...',
          }}
        />
      </div>

      {/* Create Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateTask}
      />
    </div>
  )
}
