/**
 * @fileType component
 * @domain cody
 * @pattern cody-dashboard
 * @ai-summary Main dashboard component with responsive layout — Sheet for mobile controls and task detail
 */
'use client'

import { useState, useEffect } from 'react'
import type { CodyTask } from '../types'
import { TaskList } from './TaskList'
import { TaskDetailDialog } from './TaskDetailDialog'
import { CreateTaskDialog } from './CreateTaskDialog'
import { BugReportDialog } from './BugReportDialog'
import { CodyChat } from './CodyChat'
import { CodyStatusBanner } from './CodyStatusBanner'
import { FilterBar, DATE_FILTERS, STATUS_FILTERS } from './FilterBar'
import { TaskDetail } from './TaskDetail'
import { Button } from '@/ui/web/components/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/web/components/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/ui/web/components/sheet'
import { MessageSquare, Bug, Menu, RefreshCw, Bell, Globe } from 'lucide-react'
import { useCodyTasks } from '../hooks'
import { useBrowserNotifications } from '../hooks/useBrowserNotifications'
import { useMediaQuery } from '@/server/payload/hooks/useMediaQuery'
import { RateLimitError, NoTokenError, tasksApi } from '../api'
import { toast } from 'sonner'
import { EnvironmentToolbar } from './EnvironmentToolbar'
import { SITE_URLS } from '../constants'

export function CodyDashboard() {
  const [selectedTask, setSelectedTask] = useState<CodyTask | null>(null)
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null)
  const [mergingTaskId, setMergingTaskId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showBugDialog, setShowBugDialog] = useState(false)
  const [dateFilter, setDateFilter] = useState<string>('30d')
  const [labelFilter, setLabelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showMobileDetail, setShowMobileDetail] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)

  // md breakpoint = 768px — below this is "mobile"
  const isDesktop = useMediaQuery('(min-width: 768px)')

  // Get days from filter
  const filter = DATE_FILTERS.find((f) => f.value === dateFilter)
  const days = filter?.days

  // Data fetching with TanStack Query (auto-refreshes: 10s when active, 30s when idle)
  const {
    data: tasks = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useCodyTasks({ days, includeDetails: false })

  // Browser notifications
  const {
    checkTaskChanges,
    permission: notificationPermission,
    isSupported: notificationsSupported,
  } = useBrowserNotifications()

  // Check for task changes when tasks update
  useEffect(() => {
    if (tasks.length > 0) {
      checkTaskChanges(tasks)
    }
  }, [tasks, dataUpdatedAt, checkTaskChanges])

  // Get unique labels from tasks (excluding internal/system labels)
  const availableLabels = Array.from(new Set(tasks.flatMap((task) => task.labels)))
    .filter(
      (label) =>
        ![
          'agent:done',
          'agent:error',
          'agent:running',
          'wontfix',
          'invalid',
          'duplicate',
          'question',
          'good first issue',
          'help wanted',
          'released',
        ].includes(label),
    )
    .sort()

  // Calculate label counts
  const labelCounts = tasks.reduce(
    (acc, task) => {
      task.labels.forEach((label) => {
        acc[label] = (acc[label] || 0) + 1
      })
      return acc
    },
    {} as Record<string, number>,
  )

  // Calculate status counts
  const statusCounts = tasks.reduce(
    (acc, task) => {
      acc[task.column] = (acc[task.column] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const totalCount = tasks.length

  // Filter tasks by label, status, and date (combined with AND logic)
  const filteredTasks = tasks.filter((task) => {
    // Status filter
    if (statusFilter !== 'all' && task.column !== statusFilter) return false
    // Label filter
    if (labelFilter !== 'all' && !task.labels.includes(labelFilter)) return false
    return true
  })

  // Check for specific errors
  const isRateLimited = error instanceof RateLimitError
  const isNoToken = error instanceof NoTokenError

  // Get retry info from error
  const retryAfter = isRateLimited ? (error as RateLimitError).retryAfter : null

  // Execute task handler

  const handleExecuteTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    setExecutingTaskId(taskId)
    try {
      await tasksApi.execute(task.issueNumber)
      refetch()
      toast.success('Task started')
    } catch (err) {
      console.error('Failed to execute task:', err)
      toast.error('Failed to start task')
    } finally {
      setExecutingTaskId(null)
    }
  }

  // Stop task handler
  const handleStopTask = async (task: CodyTask) => {
    setExecutingTaskId(task.id)
    try {
      await tasksApi.abort(task.issueNumber)
      refetch()
      toast.success('Task stopped')
    } catch (err) {
      console.error('Failed to stop task:', err)
      toast.error('Failed to stop task')
    } finally {
      setExecutingTaskId(null)
    }
  }

  // Merge PR handler - approves review and merges
  const handleMerge = async (task: CodyTask) => {
    if (!task.associatedPR) return

    setMergingTaskId(task.id)
    try {
      await tasksApi.approveReview(task)
      refetch()
      toast.success('PR merged')
    } catch (err) {
      console.error('Failed to merge PR:', err)
      toast.error('Failed to merge PR')
    } finally {
      setMergingTaskId(null)
    }
  }

  // Task selection — on mobile, open Sheet; on desktop, select in right panel
  const handleTaskSelect = (task: CodyTask | null) => {
    if (task) {
      setSelectedTask(task)
      // Only open the mobile sheet on mobile
      if (!isDesktop) {
        setShowMobileDetail(true)
      }
    } else {
      setSelectedTask(null)
      setShowMobileDetail(false)
    }
  }

  // Mobile filter controls — rendered inside the mobile menu Sheet
  const mobileFilterControls = (
    <>
      {/* Date filter */}
      <Select value={dateFilter} onValueChange={setDateFilter}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Filter by date" />
        </SelectTrigger>
        <SelectContent>
          {DATE_FILTERS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Status filter */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTERS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label} ({f.value === 'all' ? totalCount : statusCounts[f.value] || 0})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Label filter */}
      <Select value={labelFilter} onValueChange={setLabelFilter}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Filter by label" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All ({totalCount})</SelectItem>
          {availableLabels.map((label) => (
            <SelectItem key={label} value={label}>
              {label} ({labelCounts[label] || 0})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )

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
        {/* Header — action buttons only, no filters */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border">
          <h1 className="text-lg md:text-xl font-semibold text-foreground">Cody Operations</h1>

          {/* Desktop controls */}
          <div className="hidden md:flex items-center gap-3">
            {/* Notification status */}
            {notificationsSupported && (
              <Button
                variant="ghost"
                size="sm"
                title={
                  notificationPermission === 'granted'
                    ? 'Notifications enabled'
                    : 'Enable notifications'
                }
                onClick={() => Notification.requestPermission()}
                className={
                  notificationPermission === 'granted' ? 'text-green-500' : 'text-muted-foreground'
                }
              >
                <Bell className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              title="Refresh tasks"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" title="Report a bug" onClick={() => setShowBugDialog(true)}>
              <Bug className="w-4 h-4 mr-2" />
              Report Bug
            </Button>
            <Button title="Create new task" onClick={() => setShowCreateDialog(true)}>
              + New Task
            </Button>
          </div>

          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setShowMobileMenu(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Filter Sub-header — desktop only, separate component */}
        <div className="hidden md:block">
          <FilterBar
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            labelFilter={labelFilter}
            onLabelFilterChange={setLabelFilter}
            availableLabels={availableLabels}
            labelCounts={labelCounts}
            statusCounts={statusCounts}
            totalCount={totalCount}
            filteredCount={filteredTasks.length}
          />
        </div>

        {/* Environment Toolbar */}
        <EnvironmentToolbar />

        {/* Cody Status Banner */}
        <CodyStatusBanner tasks={tasks} isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />

        {/* Task List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading && tasks.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <TaskList
              tasks={filteredTasks}
              selectedTask={selectedTask}
              executingTaskId={executingTaskId}
              mergingTaskId={mergingTaskId}
              onTaskSelect={handleTaskSelect}
              onExecuteTask={handleExecuteTask}
              onStopTask={handleStopTask}
              onApproveReview={handleMerge}
            />
          )}
        </div>
      </div>

      {/* Desktop: Task Detail Dialog — separate component */}
      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onRefresh={refetch}
      />

      {/* Desktop: Chat Panel (right side, always visible) */}
      <div className="hidden md:block w-[400px] border-l border-border">
        <CodyChat />
      </div>

      {/* Mobile Menu Sheet */}
      <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
        <SheetContent side="right" className="w-[280px] p-0">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription className="sr-only">Dashboard controls and filters</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            {/* Chat */}
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => {
                setShowMobileMenu(false)
                setShowMobileChat(true)
              }}
            >
              <MessageSquare className="w-4 h-4" />
              Chat with Cody
            </Button>

            {/* Filters */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Filters</span>
              {mobileFilterControls}
            </div>

            {/* Environment Links */}
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Environment
              </span>
              <a href={SITE_URLS.dev} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Globe className="w-4 h-4" />
                  Dev Site
                </Button>
              </a>
              <a href={SITE_URLS.prod} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Globe className="w-4 h-4" />
                  Prod Site
                </Button>
              </a>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-xs font-medium text-muted-foreground uppercase">Actions</span>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  setShowMobileMenu(false)
                  setShowBugDialog(true)
                }}
              >
                <Bug className="w-4 h-4" />
                Report Bug
              </Button>
              <Button
                className="w-full"
                onClick={() => {
                  setShowMobileMenu(false)
                  setShowCreateDialog(true)
                }}
              >
                + New Task
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile Task Detail Sheet — only rendered on mobile */}
      {!isDesktop && (
        <Sheet
          open={showMobileDetail && !!selectedTask}
          onOpenChange={(open) => {
            if (!open) {
              setShowMobileDetail(false)
              setSelectedTask(null)
            }
          }}
        >
          <SheetContent side="right" className="w-full sm:w-[400px] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Task Details</SheetTitle>
              <SheetDescription>View and manage task details</SheetDescription>
            </SheetHeader>
            <TaskDetail
              task={selectedTask}
              onClose={() => {
                setShowMobileDetail(false)
                setSelectedTask(null)
              }}
              onRefresh={refetch}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Mobile Chat Sheet — only rendered on mobile */}
      {!isDesktop && (
        <Sheet open={showMobileChat} onOpenChange={setShowMobileChat}>
          <SheetContent side="right" className="w-full sm:w-[400px] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Chat with Cody</SheetTitle>
              <SheetDescription>AI assistant chat</SheetDescription>
            </SheetHeader>
            <CodyChat />
          </SheetContent>
        </Sheet>
      )}

      {/* Create Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={refetch}
      />

      {/* Bug Report Dialog */}
      <BugReportDialog
        open={showBugDialog}
        onClose={() => setShowBugDialog(false)}
        onCreated={refetch}
      />
    </div>
  )
}
