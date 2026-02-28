/**
 * @fileType component
 * @domain cody
 * @pattern cody-dashboard
 * @ai-summary Main dashboard component with responsive layout — Sheet for mobile controls and task detail
 */
'use client'

import { useState } from 'react'
import type { CodyTask } from '../types'
import { TaskList } from './TaskList'
import { TaskDetail } from './TaskDetail'
import { CreateTaskDialog } from './CreateTaskDialog'
import { BugReportDialog } from './BugReportDialog'
import { CodyChat } from './CodyChat'
import { CodyStatusBanner } from './CodyStatusBanner'
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
import { MessageSquare, X, Bug, Menu } from 'lucide-react'
import { useCodyTasks } from '../hooks'
import { useMediaQuery } from '@/server/payload/hooks/useMediaQuery'
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
  const [showBugDialog, setShowBugDialog] = useState(false)
  const [dateFilter, setDateFilter] = useState<string>('30d')
  const [labelFilter, setLabelFilter] = useState<string>('all')
  const [showChat, setShowChat] = useState(false)
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

  // Filter tasks by label
  const filteredTasks =
    labelFilter === 'all' ? tasks : tasks.filter((task) => task.labels.includes(labelFilter))

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

  // Merge PR handler - approves review and merges
  const handleMerge = async (task: CodyTask) => {
    if (!task.associatedPR) return

    try {
      await tasksApi.approveReview(task)
      refetch()
    } catch (err) {
      console.error('Failed to merge PR:', err)
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

  // Filter controls — shared between desktop header and mobile menu
  const filterControls = (
    <>
      {/* Date filter */}
      <Select value={dateFilter} onValueChange={setDateFilter}>
        <SelectTrigger className="w-full md:w-40">
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
      {/* Label filter */}
      <Select value={labelFilter} onValueChange={setLabelFilter}>
        <SelectTrigger className="w-full md:w-36">
          <SelectValue placeholder="Filter by label" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Labels</SelectItem>
          {availableLabels.map((label) => (
            <SelectItem key={label} value={label}>
              {label}
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
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border">
          <h1 className="text-lg md:text-xl font-semibold text-foreground">Cody Operations</h1>

          {/* Desktop controls */}
          <div className="hidden md:flex items-center gap-3">
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
            {filterControls}
            <Button variant="outline" onClick={() => setShowBugDialog(true)}>
              <Bug className="w-4 h-4 mr-2" />
              Report Bug
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>+ New Task</Button>
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

        {/* Cody Status Banner */}
        <CodyStatusBanner
          tasks={tasks}
          onTaskSelect={handleTaskSelect}
          isFetching={isFetching}
          dataUpdatedAt={dataUpdatedAt}
        />

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
              onTaskSelect={handleTaskSelect}
              onExecuteTask={handleExecuteTask}
              onApproveReview={handleMerge}
            />
          )}
        </div>
      </div>

      {/* Desktop Right Panel: Chat or Task Detail */}
      <div
        className={`hidden md:block ${showChat ? 'w-[400px]' : 'w-96'} border-l border-border transition-all duration-200`}
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
              {filterControls}
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
