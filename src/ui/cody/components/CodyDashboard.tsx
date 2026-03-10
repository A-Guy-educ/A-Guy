/**
 * @fileType component
 * @domain cody
 * @pattern cody-dashboard
 * @ai-summary Main dashboard component with responsive layout — Sheet for mobile controls and task detail
 */
'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { CodyTask } from '../types'
import { TaskList } from './TaskList'

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
import { useCodyTasks, queryKeys } from '../hooks'
import { useBrowserNotifications } from '../hooks/useBrowserNotifications'
import { useMediaQuery } from '@/server/payload/hooks/useMediaQuery'
import { RateLimitError, NoTokenError, tasksApi, codyApi } from '../api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { EnvironmentToolbar } from './EnvironmentToolbar'
import { GitHubUserPickerDialog } from './GitHubUserPickerDialog'
import { useGitHubIdentity } from '../hooks/useGitHubIdentity'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/web/components/avatar'
import { SimpleTooltip } from './SimpleTooltip'
import { SITE_URLS } from '../constants'

interface CodyDashboardProps {
  initialIssueNumber?: number
}

export function CodyDashboard({ initialIssueNumber }: CodyDashboardProps) {
  const initialIssueRef = useRef(initialIssueNumber)
  // #1: Track selection by issue number, derive task from query data
  const [selectedIssueNumber, setSelectedIssueNumber] = useState<number | null>(null)
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
  } = useCodyTasks({ days })

  const queryClient = useQueryClient()

  // #1: Derive selectedTask from query data — always fresh
  const selectedTask = useMemo(
    () =>
      selectedIssueNumber
        ? (tasks.find((t) => t.issueNumber === selectedIssueNumber) ?? null)
        : null,
    [selectedIssueNumber, tasks],
  )

  // GitHub identity (localStorage — forced on first visit)
  const {
    githubUser,
    isLoaded: identityLoaded,
    setGitHubUser,
    clearGitHubUser,
  } = useGitHubIdentity()

  // Fetch collaborators for assignee picker + identity picker
  const { data: collaborators = [], isLoading: collaboratorsLoading } = useQuery({
    queryKey: ['cody-collaborators'],
    queryFn: () => codyApi.collaborators.list(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Mutations for assign/unassign
  const assignMutation = useMutation({
    mutationFn: ({ issueNumber, assignees }: { issueNumber: number; assignees: string[] }) =>
      codyApi.tasks.assign(issueNumber, assignees, githubUser?.login),
    onSuccess: () => {
      toast.success('Assigned')
    },
  })

  const unassignMutation = useMutation({
    mutationFn: ({ issueNumber, assignees }: { issueNumber: number; assignees: string[] }) =>
      codyApi.tasks.unassign(issueNumber, assignees, githubUser?.login),
    onSuccess: () => {
      toast.success('Unassigned')
    },
  })

  // #2: Replace manual try/catch handlers with mutations + optimistic updates
  const executeMutation = useMutation({
    mutationFn: (task: CodyTask) => tasksApi.execute(task.issueNumber, githubUser?.login),
    // #3: Optimistic update — move task to "building" immediately
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks(days) })
      const previous = queryClient.getQueryData<CodyTask[]>(queryKeys.tasks(days))
      queryClient.setQueryData<CodyTask[]>(queryKeys.tasks(days), (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, column: 'building' as const } : t)),
      )
      return { previous }
    },
    onError: (_err, _task, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.tasks(days), context.previous)
      }
      toast.error('Failed to start task')
    },
    onSuccess: () => {
      toast.success('Task started')
      // Let polling handle the refresh — don't force an immediate refetch
    },
  })

  const stopMutation = useMutation({
    mutationFn: (task: CodyTask) => tasksApi.abort(task.issueNumber, githubUser?.login),
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks(days) })
      const previous = queryClient.getQueryData<CodyTask[]>(queryKeys.tasks(days))
      queryClient.setQueryData<CodyTask[]>(queryKeys.tasks(days), (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, column: 'open' as const } : t)),
      )
      return { previous }
    },
    onError: (_err, _task, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.tasks(days), context.previous)
      }
      toast.error('Failed to stop task')
    },
    onSuccess: () => {
      toast.success('Task stopped')
    },
  })

  const mergeMutation = useMutation({
    mutationFn: (task: CodyTask) => tasksApi.approveReview(task, githubUser?.login),
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks(days) })
      const previous = queryClient.getQueryData<CodyTask[]>(queryKeys.tasks(days))
      queryClient.setQueryData<CodyTask[]>(queryKeys.tasks(days), (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, column: 'done' as const } : t)),
      )
      return { previous }
    },
    onError: (_err, _task, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.tasks(days), context.previous)
      }
      toast.error('Failed to merge PR')
    },
    onSuccess: () => {
      toast.success('PR merged')
    },
  })

  // Derive per-task pending state from mutations
  const executingTaskId = executeMutation.isPending
    ? ((executeMutation.variables as CodyTask | undefined)?.id ?? null)
    : stopMutation.isPending
      ? ((stopMutation.variables as CodyTask | undefined)?.id ?? null)
      : null

  const mergingTaskId = mergeMutation.isPending
    ? ((mergeMutation.variables as CodyTask | undefined)?.id ?? null)
    : null

  // Handlers now just delegate to mutations
  const handleExecuteTask = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId)
      if (task) executeMutation.mutate(task)
    },
    [tasks, executeMutation],
  )

  const handleStopTask = useCallback(
    (task: CodyTask) => {
      stopMutation.mutate(task)
    },
    [stopMutation],
  )

  const handleMerge = useCallback(
    async (task: CodyTask) => {
      if (!task.associatedPR) return
      mergeMutation.mutate(task)
    },
    [mergeMutation],
  )

  // #4: Prefetch task details on hover
  const handleTaskHover = useCallback(
    (task: CodyTask) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.taskDetails(task.issueNumber),
        queryFn: () => codyApi.tasks.get(task.issueNumber),
        staleTime: 60_000, // 60s — don't re-prefetch on rapid hovers
      })
    },
    [queryClient],
  )

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

  // Helper: extract issue number from URL pathname
  const getIssueFromUrl = () => {
    const match = window.location.pathname.match(/\/cody\/(\d+)/)
    return match ? parseInt(match[1], 10) : null
  }

  // Task selection — uses pushState for browser history support
  const handleTaskSelect = useCallback(
    (task: CodyTask | null) => {
      if (task) {
        setSelectedIssueNumber(task.issueNumber)
        window.history.pushState(null, '', `/cody/${task.issueNumber}`)
        if (!isDesktop) {
          setShowMobileDetail(true)
        }
      } else {
        setSelectedIssueNumber(null)
        setShowMobileDetail(false)
        window.history.pushState(null, '', '/cody')
      }
    },
    [isDesktop],
  )

  // Auto-select task from URL on initial load
  useEffect(() => {
    const issueNum = initialIssueRef.current
    if (!issueNum || selectedIssueNumber) return
    if (tasks.length === 0) return

    const match = tasks.find((t) => t.issueNumber === issueNum)
    if (match) {
      setSelectedIssueNumber(match.issueNumber)
      if (!isDesktop) {
        setShowMobileDetail(true)
      }
      initialIssueRef.current = undefined
    }
  }, [tasks, isDesktop]) // eslint-disable-line react-hooks/exhaustive-deps

  // Browser back/forward — listen to popstate and sync selected task
  useEffect(() => {
    const handlePopState = () => {
      const issueNum = getIssueFromUrl()
      if (issueNum) {
        const match = tasks.find((t) => t.issueNumber === issueNum)
        if (match) {
          setSelectedIssueNumber(match.issueNumber)
          if (!isDesktop) setShowMobileDetail(true)
        }
      } else {
        setSelectedIssueNumber(null)
        setShowMobileDetail(false)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [tasks, isDesktop])

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

  // Show identity picker if no GitHub user is selected yet
  const showIdentityPicker = identityLoaded && !githubUser

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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* GitHub identity picker — forced on first visit */}
      <GitHubUserPickerDialog
        open={showIdentityPicker}
        collaborators={collaborators}
        isLoading={collaboratorsLoading}
        onSelect={setGitHubUser}
      />
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* When a task is selected, TaskDetail takes over the entire left column */}
        {selectedTask ? (
          <TaskDetail
            task={selectedTask}
            onClose={() => handleTaskSelect(null)}
            onRefresh={refetch}
            onApproveReview={handleMerge}
            isMerging={!!(selectedTask && mergingTaskId === selectedTask.id)}
          />
        ) : (
          <>
            {/* Header — action buttons only, no filters */}
            <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-white/[0.06] bg-black/20">
              <h1 className="text-lg md:text-xl font-semibold text-foreground">Cody Operations</h1>

              {/* Desktop controls */}
              <div className="hidden md:flex items-center gap-3">
                {/* GitHub identity badge */}
                {githubUser && (
                  <SimpleTooltip
                    content={`Logged in as @${githubUser.login} — click to switch`}
                    side="bottom"
                  >
                    <button
                      type="button"
                      onClick={clearGitHubUser}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-accent transition-colors"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={githubUser.avatar_url} alt={githubUser.login} />
                        <AvatarFallback>{githubUser.login[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">@{githubUser.login}</span>
                    </button>
                  </SimpleTooltip>
                )}

                {/* Notification status */}
                {notificationsSupported && (
                  <SimpleTooltip
                    content={
                      notificationPermission === 'granted'
                        ? 'Notifications enabled'
                        : 'Enable notifications'
                    }
                    side="bottom"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => Notification.requestPermission()}
                      className={
                        notificationPermission === 'granted'
                          ? 'text-green-500'
                          : 'text-muted-foreground'
                      }
                    >
                      <Bell className="w-4 h-4" />
                    </Button>
                  </SimpleTooltip>
                )}
                <SimpleTooltip content="Refresh tasks" side="bottom">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="gap-1"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                  </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Report a bug" side="bottom">
                  <Button variant="outline" onClick={() => setShowBugDialog(true)}>
                    <Bug className="w-4 h-4 mr-2" />
                    Report Bug
                  </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Create new task" side="bottom">
                  <Button onClick={() => setShowCreateDialog(true)}>+ New Task</Button>
                </SimpleTooltip>
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
                  onTaskHover={handleTaskHover}
                  collaborators={collaborators}
                  onAssign={(issueNumber, assignees) =>
                    assignMutation.mutate({ issueNumber, assignees })
                  }
                  onUnassign={(issueNumber, assignees) =>
                    unassignMutation.mutate({ issueNumber, assignees })
                  }
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Desktop: Chat Panel (right side, always visible) */}
      <div className="hidden md:block w-[400px] border-l border-border">
        <CodyChat selectedTask={selectedTask} />
      </div>

      {/* Mobile Menu Sheet */}
      <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
        <SheetContent side="right" className="w-[280px] p-0">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription className="sr-only">Dashboard controls and filters</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            {/* GitHub identity */}
            {githubUser && (
              <button
                type="button"
                onClick={() => {
                  clearGitHubUser()
                  setShowMobileMenu(false)
                }}
                className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent transition-colors border border-border"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={githubUser.avatar_url} alt={githubUser.login} />
                  <AvatarFallback>{githubUser.login[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">@{githubUser.login}</span>
                  <span className="text-xs text-muted-foreground">Tap to switch</span>
                </div>
              </button>
            )}

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
              handleTaskSelect(null)
            }
          }}
        >
          <SheetContent side="right" className="w-full sm:w-[400px] p-0" hideClose>
            <SheetHeader className="sr-only">
              <SheetTitle>Task Details</SheetTitle>
              <SheetDescription>View and manage task details</SheetDescription>
            </SheetHeader>
            <TaskDetail
              task={selectedTask}
              onClose={() => handleTaskSelect(null)}
              onRefresh={refetch}
              onApproveReview={handleMerge}
              isMerging={!!(selectedTask && mergingTaskId === selectedTask.id)}
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
            <CodyChat selectedTask={selectedTask} />
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
