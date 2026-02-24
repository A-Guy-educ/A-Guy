/**
 * @fileType component
 * @domain cody
 * @pattern cody-dashboard
 * @ai-summary Main dashboard component using design system
 */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CodyTask, Board } from '../types'
import { KanbanBoard } from './KanbanBoard'
import { TaskDetail } from './TaskDetail'
import { CreateTaskDialog } from './CreateTaskDialog'
import { CodyChat } from './CodyChat'
import { Button } from '@/ui/web/components/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/web/components/select'
import { MessageSquare, X } from 'lucide-react'
import { POLLING_INTERVALS } from '../constants'

const API_BASE = '/api/cody'

// Date filter options
const DATE_FILTERS = [
  { label: 'All time', value: 'all', days: undefined },
  { label: 'Last 7 days', value: '7d', days: 7 },
  { label: 'Last 30 days', value: '30d', days: 30 },
  { label: 'Last 90 days', value: '90d', days: 90 },
] as const

// Error types from API
interface RateLimitError {
  error: 'rate_limited'
  message: string
  retryAfter: string
  resetTime: string | null
}

interface NoTokenError {
  error: 'no_token'
  message: string
}

function isRateLimitError(error: unknown): error is RateLimitError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    (error as Record<string, unknown>).error === 'rate_limited'
  )
}

function isNoTokenError(error: unknown): error is NoTokenError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    (error as Record<string, unknown>).error === 'no_token'
  )
}

export function CodyDashboard() {
  const [tasks, setTasks] = useState<CodyTask[]>([])
  const [boards, setBoards] = useState<Board[]>([])
  const [selectedTask, setSelectedTask] = useState<CodyTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [retryAfter, setRetryAfter] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [dateFilter, setDateFilter] = useState<string>('30d')
  const [showChat, setShowChat] = useState(false)

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
      // Build URL with date filter
      const filter = DATE_FILTERS.find((f) => f.value === dateFilter)
      const url = filter?.days
        ? `${API_BASE}/tasks?days=${filter.days}&includeDetails=false`
        : `${API_BASE}/tasks?includeDetails=false`
      const res = await fetch(url)
      const data = await res.json()

      // Handle rate limit specifically
      if (res.status === 429 || isRateLimitError(data)) {
        setRateLimited(true)
        setRetryAfter(data.retryAfter || null)
        setTasks([])
        setError(null)
        return
      }

      // Handle no token
      if (res.status === 401 || isNoTokenError(data)) {
        setError('GITHUB_TOKEN is not configured. Please add it to your environment variables.')
        setTasks([])
        setRateLimited(false)
        return
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch tasks')
      }

      setTasks(data.tasks || [])
      setError(null)
      setRateLimited(false)
      setRetryAfter(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setRateLimited(false)
    } finally {
      setLoading(false)
    }
  }, [dateFilter])

  // Execute task - trigger Cody by posting /cody comment
  const handleExecuteTask = useCallback(
    async (taskId: string) => {
      try {
        const res = await fetch(`${API_BASE}/tasks/${taskId}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'execute' }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to execute task')
        }

        // Refresh tasks to show updated state
        fetchTasks()
      } catch (err) {
        console.error('Error executing task:', err)
        setError(err instanceof Error ? err.message : 'Failed to execute task')
      }
    },
    [fetchTasks],
  )

  // Initial fetch
  useEffect(() => {
    fetchBoards()
    fetchTasks()
  }, [fetchBoards, fetchTasks])

  // Determine polling interval based on task state
  const getPollingInterval = useCallback(() => {
    // If no tasks or all done, use idle interval
    const hasRunningTasks = tasks.some(
      (t) => t.pipeline && !['completed', 'failed', 'timeout'].includes(t.pipeline.state),
    )
    const hasActiveTask =
      selectedTask?.pipeline &&
      !['completed', 'failed', 'timeout'].includes(selectedTask.pipeline.state)

    if (hasActiveTask) {
      return POLLING_INTERVALS.active // 5s when viewing active task
    }
    if (hasRunningTasks) {
      return POLLING_INTERVALS.board // 10s when tasks are running
    }
    return POLLING_INTERVALS.idle // 30s when idle
  }, [tasks, selectedTask])

  // Smart polling with visibility detection
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const updatePolling = () => {
      // Clear existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      // Only poll if page is visible
      if (document.hidden) {
        return
      }

      const interval = getPollingInterval()
      intervalRef.current = setInterval(() => {
        fetchTasks()
      }, interval)
    }

    // Initial setup
    updatePolling()

    // Reconfigure on visibility change or task state change
    const handleVisibilityChange = () => {
      updatePolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchTasks, getPollingInterval])

  // Rate limit error display
  if (rateLimited) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">GitHub API Rate Limited</h2>
          <p className="text-muted-foreground mb-4">
            Too many requests to GitHub. Please wait before refreshing.
          </p>
          {retryAfter && <p className="text-sm text-yellow-500 mb-4">Retry after: {retryAfter}</p>}
          <Button onClick={fetchTasks} variant="outline">
            Retry Now
          </Button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Unable to Load Tasks</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchTasks}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h1 className="text-xl font-semibold text-foreground">Cody Operations</h1>
          <div className="flex items-center gap-3">
            {/* Chat toggle */}
            <Button
              variant={showChat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowChat(!showChat)}
              className="gap-2"
            >
              {showChat ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
              {showChat ? 'Close Chat' : 'Chat'}
            </Button>
            {/* Date filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                {DATE_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowCreateDialog(true)}>+ New Task</Button>
          </div>
        </div>

        {/* Board */}
        <div className="flex-1 overflow-hidden">
          {loading && tasks.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <KanbanBoard
              tasks={tasks}
              boards={boards}
              selectedTask={selectedTask}
              onTaskSelect={setSelectedTask}
              onExecuteTask={handleExecuteTask}
            />
          )}
        </div>
      </div>

      {/* Right Panel: Chat or Task Detail */}
      <div
        className={`${showChat ? 'w-[400px]' : 'w-96'} border-s border-border transition-all duration-200`}
      >
        {showChat ? (
          <CodyChat />
        ) : (
          <TaskDetail
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onRefresh={fetchTasks}
          />
        )}
      </div>

      {/* Create Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={fetchTasks}
      />
    </div>
  )
}
