/**
 * @fileType component
 * @domain cody
 * @pattern cody-dashboard
 * @ai-summary Main dashboard component using TanStack Query hooks
 */
'use client'

import { useState } from 'react'
import type { CodyTask } from '../types'
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
import { useCodyTasks, useCodyBoards } from '../hooks'
import { RateLimitError, NoTokenError, tasksApi } from '../api'

const DATE_FILTERS = [
  { label: 'All time', value: 'all', days: undefined },
  { label: 'Last 7 days', value: '7d', days: 7 },
  { label: 'Last 30 days', value: '30d', days: 30 },
  { label: 'Last 90 days', value: '90d', days: 90 },
] as const

export function CodyDashboard() {
  const [selectedTask, setSelectedTask] = useState<CodyTask | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [dateFilter, setDateFilter] = useState<string>('30d')
  const [showChat, setShowChat] = useState(false)

  // Get days from filter
  const filter = DATE_FILTERS.find((f) => f.value === dateFilter)
  const days = filter?.days

  // Data fetching with TanStack Query
  const {
    data: tasks = [],
    isLoading,
    error,
    refetch,
  } = useCodyTasks({ days, includeDetails: false })

  const { data: boards = [] } = useCodyBoards()

  // Check for specific errors
  const isRateLimited = error instanceof RateLimitError
  const isNoToken = error instanceof NoTokenError

  // Get retry info from error
  const retryAfter = isRateLimited ? (error as RateLimitError).retryAfter : null

  // Execute task handler
  const handleExecuteTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    try {
      await tasksApi.execute(task.issueNumber)
      refetch()
    } catch (err) {
      console.error('Failed to execute task:', err)
    }
  }

  // Rate limit error display
  if (isRateLimited) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">GitHub API Rate Limited</h2>
          <p className="text-muted-foreground mb-4">
            Too many requests to GitHub. Please wait before refreshing.
          </p>
          {retryAfter && <p className="text-sm text-yellow-500 mb-4">Retry after: {retryAfter}</p>}
          <Button onClick={() => refetch()} variant="outline">
            Retry Now
          </Button>
        </div>
      </div>
    )
  }

  // No token error display
  if (isNoToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Unable to Load Tasks</h2>
          <p className="text-muted-foreground mb-4">
            GITHUB_TOKEN is not configured. Please add it to your environment variables.
          </p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    )
  }

  // Generic error display
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Unable to Load Tasks</h2>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <Button onClick={() => refetch()}>Retry</Button>
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
          {isLoading && tasks.length === 0 ? (
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
        className={`${showChat ? 'w-[400px]' : 'w-96'} border-l border-border transition-all duration-200`}
      >
        {showChat ? (
          <CodyChat />
        ) : (
          <TaskDetail
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onRefresh={refetch}
          />
        )}
      </div>

      {/* Create Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={refetch}
      />
    </div>
  )
}
