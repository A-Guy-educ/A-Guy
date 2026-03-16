/**
 * @fileType component
 * @domain cody
 * @pattern cody-dashboard
 * @ai-summary Main dashboard component with responsive layout — Sheet for mobile controls and task detail
 */
'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { CodyTask, SortField } from '../types'
import { filterTasksByView, getViewModeCounts, sortTasks } from '../utils'
import { TaskList } from './TaskList'
import { QueueView } from './QueueView'

import { CreateTaskDialog } from './CreateTaskDialog'
import { EditTaskDialog } from './EditTaskDialog'
import { BugReportDialog } from './BugReportDialog'
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog'
import { BranchCleanupDialog } from './BranchCleanupDialog'
import { CodyChat } from './CodyChat'
import { CodyStatusBanner } from './CodyStatusBanner'
import { FilterBar, ViewToggle, DATE_FILTERS, STATUS_FILTERS, type ViewMode } from './FilterBar'
import { TaskDetail } from './TaskDetail'
import { PreviewModal } from './PreviewModal'
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
import {
  MessageSquare,
  Bug,
  Menu,
  RefreshCw,
  Bell,
  Globe,
  AlertCircle,
  X as XIcon,
  Sun,
  Moon,
  GitBranch,
} from 'lucide-react'
import { useCodyTasks, queryKeys } from '../hooks'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useBrowserNotifications } from '../hooks/useBrowserNotifications'
import { useMediaQuery } from '@/server/payload/hooks/useMediaQuery'
import { RateLimitError, NoTokenError, tasksApi, codyApi } from '../api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { EnvironmentToolbar } from './EnvironmentToolbar'
import { ErrorBoundary } from './ErrorBoundary'
import { useGitHubIdentity } from '../hooks/useGitHubIdentity'
import { useTheme } from '@/ui/web/providers/Theme'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/web/components/avatar'
import { SimpleTooltip } from './SimpleTooltip'
import { SITE_URLS } from '../constants'

interface CodyDashboardProps {
  initialIssueNumber?: number
  initialModal?: 'new' | 'bug' | 'chat'
}

export function CodyDashboard({ initialIssueNumber, initialModal }: CodyDashboardProps) {
  const initialIssueRef = useRef(initialIssueNumber)
  // #1: Track selection by issue number, derive task from query data
  const [selectedIssueNumber, setSelectedIssueNumber] = useState<number | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showBugDialog, setShowBugDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<CodyTask | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [duplicateSource, setDuplicateSource] = useState<CodyTask | null>(null)
  const [showBranchCleanup, setShowBranchCleanup] = useState(false)
  const [dateFilter, setDateFilter] = useState<string>(() => {
    if (typeof window === 'undefined') return '30d'
    return new URLSearchParams(window.location.search).get('date') ?? '30d'
  })
  const [labelFilter, setLabelFilter] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all'
    return new URLSearchParams(window.location.search).get('label') ?? 'all'
  })
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all'
    return new URLSearchParams(window.location.search).get('status') ?? 'all'
  })
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'running'
    const v = new URLSearchParams(window.location.search).get('view')
    return (['backlog', 'queue'].includes(v ?? '') ? v : 'running') as ViewMode
  })
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showMobileDetail, setShowMobileDetail] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('q') ?? ''
  })
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)
  const [sortField, setSortField] = useState<string>(() => {
    if (typeof window === 'undefined') return 'updatedAt'
    return new URLSearchParams(window.location.search).get('sort') ?? 'updatedAt'
  })
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    if (typeof window === 'undefined') return 'desc'
    return (new URLSearchParams(window.location.search).get('dir') as 'asc' | 'desc') ?? 'desc'
  })
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filterBarRef = useRef<{ focusSearch: () => void } | null>(null)

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }, [])

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [])

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
  } = useCodyTasks({ days, viewMode: viewMode === 'queue' ? 'running' : viewMode })

  const queryClient = useQueryClient()

  // #1: Derive selectedTask from query data — always fresh
  const selectedTask = useMemo(
    () =>
      selectedIssueNumber
        ? (tasks.find((t) => t.issueNumber === selectedIssueNumber) ?? null)
        : null,
    [selectedIssueNumber, tasks],
  )

  // GitHub identity — verified via OAuth session cookie
  const { githubUser, clearGitHubUser } = useGitHubIdentity()

  // Theme toggle
  const { theme, setTheme } = useTheme()

  // Fetch collaborators for assignee picker
  const { data: collaborators = [] } = useQuery({
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
      setErrorDismissed(false) // Reset banner dismissal on successful fetch
    }
  }, [tasks, dataUpdatedAt, checkTaskChanges])

  // Persist filter state in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (dateFilter !== '30d') params.set('date', dateFilter)
    else params.delete('date')
    if (statusFilter !== 'all') params.set('status', statusFilter)
    else params.delete('status')
    if (labelFilter !== 'all') params.set('label', labelFilter)
    else params.delete('label')
    if (viewMode !== 'running') params.set('view', viewMode)
    else params.delete('view')
    if (debouncedSearch) params.set('q', debouncedSearch)
    else params.delete('q')
    const search = params.toString()
    const newUrl = window.location.pathname + (search ? `?${search}` : '')
    window.history.replaceState(null, '', newUrl)
  }, [dateFilter, statusFilter, labelFilter, viewMode, debouncedSearch])

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

  // View mode counts — backlog = open column, running = everything else
  const { runningCount, backlogCount, queueCount } = getViewModeCounts(tasks)

  // Filter tasks by view mode, then by status and label (combined with AND logic)
  const baseFilteredTasks = filterTasksByView(tasks, { viewMode, statusFilter, labelFilter })
  const searchedTasks = useMemo(() => {
    if (!debouncedSearch.trim()) return baseFilteredTasks
    const q = debouncedSearch.toLowerCase()
    return baseFilteredTasks.filter(
      (t) => t.title.toLowerCase().includes(q) || String(t.issueNumber).includes(q),
    )
  }, [baseFilteredTasks, debouncedSearch])

  // Sort tasks
  const sortedTasks = useMemo(
    () => sortTasks(searchedTasks, sortField as SortField, sortDirection),
    [searchedTasks, sortField, sortDirection],
  )

  const filteredTasks = sortedTasks

  // Keyboard shortcuts (after sortedTasks is defined)
  useKeyboardShortcuts({
    isModalOpen:
      showCreateDialog ||
      !!editingTask ||
      showBugDialog ||
      showBranchCleanup ||
      showPreview ||
      showShortcutsHelp ||
      showMobileMenu ||
      showMobileDetail ||
      showMobileChat,
    onNavigateDown: () => setFocusedIndex((i) => Math.min(i + 1, sortedTasks.length - 1)),
    onNavigateUp: () => setFocusedIndex((i) => Math.max(i - 1, 0)),
    onOpenSelected: () => {
      if (sortedTasks[focusedIndex]) handleTaskSelect(sortedTasks[focusedIndex])
    },
    onCloseDetail: () => {
      if (selectedTask) handleTaskSelect(null)
      else if (showPreview) setShowPreview(false)
      else if (showShortcutsHelp) setShowShortcutsHelp(false)
    },
    onRefresh: () => refetch(),
    onNewTask: () => setShowCreateDialog(true),
    onEdit: () => {
      if (selectedTask && selectedTask.column === 'open') setEditingTask(selectedTask)
    },
    onOpenPreview: () => {
      if (selectedTask?.associatedPR) setShowPreview(true)
    },
    onFocusSearch: () => {
      filterBarRef.current?.focusSearch()
    },
    onShowHelp: () => setShowShortcutsHelp(true),
  })

  // Reset focused index when task list changes
  useEffect(() => {
    setFocusedIndex(0)
  }, [sortedTasks.length, viewMode, statusFilter, labelFilter, debouncedSearch])

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

  // Helper: check if URL is a preview URL
  const isPreviewUrl = () => /\/cody\/\d+\/preview/.test(window.location.pathname)

  // Helper: detect modal route from URL
  const getModalFromUrl = (): 'new' | 'bug' | 'chat' | null => {
    const path = window.location.pathname
    if (path === '/cody/new') return 'new'
    if (path === '/cody/bug') return 'bug'
    if (path === '/cody/chat') return 'chat'
    return null
  }

  // Helper: push base /cody URL (used when closing modals)
  const pushCodyBase = () => window.history.pushState(null, '', '/cody')

  // Open preview modal with URL sync
  const handleOpenPreview = useCallback((task: CodyTask) => {
    setSelectedIssueNumber(task.issueNumber)
    setShowPreview(true)
    window.history.pushState(null, '', `/cody/${task.issueNumber}/preview`)
  }, [])

  // Close preview modal with URL sync
  const handleClosePreview = useCallback(() => {
    setShowPreview(false)
    if (selectedIssueNumber) {
      window.history.pushState(null, '', `/cody/${selectedIssueNumber}`)
    }
  }, [selectedIssueNumber])

  // Open/close modal dialogs with URL sync
  const handleOpenCreate = useCallback(() => {
    setShowCreateDialog(true)
    window.history.pushState(null, '', '/cody/new')
  }, [])

  const handleCloseCreate = useCallback(() => {
    setShowCreateDialog(false)
    setDuplicateSource(null)
    pushCodyBase()
  }, [])

  const handleOpenBug = useCallback(() => {
    setShowBugDialog(true)
    window.history.pushState(null, '', '/cody/bug')
  }, [])

  const handleCloseBug = useCallback(() => {
    setShowBugDialog(false)
    pushCodyBase()
  }, [])

  const handleOpenChat = useCallback(() => {
    setShowMobileChat(true)
    window.history.pushState(null, '', '/cody/chat')
  }, [])

  const handleCloseChat = useCallback((open: boolean) => {
    setShowMobileChat(open)
    if (!open) pushCodyBase()
  }, [])

  // Handle task duplication
  const handleDuplicateTask = useCallback(
    (task: CodyTask) => {
      setDuplicateSource(task)
      handleOpenCreate()
    },
    [handleOpenCreate],
  )

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
    // Check for modal routes on initial load
    const modal = initialModal || getModalFromUrl()
    if (modal) {
      if (modal === 'new') setShowCreateDialog(true)
      else if (modal === 'bug') setShowBugDialog(true)
      else if (modal === 'chat') setShowMobileChat(true)
      return
    }

    // Check for preview URL on initial load
    if (isPreviewUrl()) {
      const issueNum = getIssueFromUrl()
      if (issueNum) {
        setSelectedIssueNumber(issueNum)
        setShowPreview(true)
        initialIssueRef.current = undefined
        return
      }
    }

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
      // Close all modals first
      setShowCreateDialog(false)
      setShowBugDialog(false)
      setShowMobileChat(false)
      setShowPreview(false)

      // Check for modal routes
      const modal = getModalFromUrl()
      if (modal) {
        if (modal === 'new') setShowCreateDialog(true)
        else if (modal === 'bug') setShowBugDialog(true)
        else if (modal === 'chat') setShowMobileChat(true)
        return
      }

      if (isPreviewUrl()) {
        const issueNum = getIssueFromUrl()
        if (issueNum) {
          setSelectedIssueNumber(issueNum)
          setShowPreview(true)
        }
        return
      }

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
      {/* View toggle */}
      <ViewToggle
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        runningCount={runningCount}
        backlogCount={backlogCount}
      />
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

  // No token error — full-page (can't function without token)
  if (isNoToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Unable to Load Tasks</h2>
          <p className="text-muted-foreground mb-4">
            {error?.message ||
              'GitHub token is not configured. Set CODY_BOT_TOKEN or GITHUB_TOKEN in environment variables.'}
          </p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    )
  }

  // Build an inline error banner message for rate limit / generic errors
  const errorBannerMessage = !errorDismissed
    ? isRateLimited
      ? `GitHub API rate limited${retryAfter ? ` — retry after ${retryAfter}` : ''}`
      : error
        ? error.message
        : null
    : null

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Preview Modal — full-screen overlay */}
        {showPreview && selectedTask && (
          <PreviewModal
            task={selectedTask}
            onClose={handleClosePreview}
            onMerge={() => handleMerge(selectedTask)}
            isMerging={!!(mergingTaskId === selectedTask.id)}
          />
        )}
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* When a task is selected, TaskDetail takes over the entire left column */}
          {selectedTask ? (
            <TaskDetail
              task={selectedTask}
              onClose={() => handleTaskSelect(null)}
              onRefresh={refetch}
              onOpenPreview={() => selectedTask && handleOpenPreview(selectedTask)}
              onEditTask={setEditingTask}
              onDuplicate={handleDuplicateTask}
            />
          ) : (
            <>
              {/* Header — action buttons only, no filters */}
              <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-white/[0.06] bg-black/20">
                <h1 className="text-lg md:text-xl font-semibold text-foreground">
                  Cody Operations
                </h1>

                {/* Desktop controls */}
                <div className="hidden md:flex items-center gap-3">
                  {/* GitHub identity badge */}
                  {githubUser && (
                    <SimpleTooltip
                      content={`Logged in as @${githubUser.login} — click to log out`}
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
                        aria-label={
                          notificationPermission === 'granted'
                            ? 'Notifications enabled'
                            : 'Enable notifications'
                        }
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

                  {/* Theme toggle */}
                  <SimpleTooltip
                    content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    side="bottom"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                      className="text-muted-foreground"
                    >
                      {theme === 'dark' ? (
                        <Sun className="w-4 h-4" />
                      ) : (
                        <Moon className="w-4 h-4" />
                      )}
                    </Button>
                  </SimpleTooltip>

                  {/* Branch cleanup */}
                  <SimpleTooltip content="Clean up branches" side="bottom">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBranchCleanup(true)}
                      aria-label="Clean up branches"
                      className="gap-1"
                    >
                      <GitBranch className="w-4 h-4" />
                      Cleanup
                    </Button>
                  </SimpleTooltip>
                  <SimpleTooltip content="Refresh tasks" side="bottom">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                      disabled={isFetching}
                      aria-label="Refresh tasks"
                      className="gap-1"
                    >
                      <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                  </SimpleTooltip>
                  <SimpleTooltip content="Report a bug" side="bottom">
                    <Button variant="outline" onClick={handleOpenBug}>
                      <Bug className="w-4 h-4 mr-2" />
                      Report Bug
                    </Button>
                  </SimpleTooltip>
                  <SimpleTooltip content="Create new task" side="bottom">
                    <Button onClick={handleOpenCreate}>+ New Task</Button>
                  </SimpleTooltip>
                </div>

                {/* Mobile hamburger */}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Open menu"
                  className="md:hidden"
                  onClick={() => setShowMobileMenu(true)}
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </div>

              {/* Filter Sub-header — desktop only, separate component */}
              <div className="hidden md:block">
                <FilterBar
                  ref={filterBarRef}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
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
                  runningCount={runningCount}
                  backlogCount={backlogCount}
                  queueCount={queueCount}
                  searchQuery={searchQuery}
                  onSearchChange={handleSearchChange}
                  sortField={sortField as SortField}
                  onSortFieldChange={setSortField}
                  sortDirection={sortDirection}
                  onSortDirectionChange={setSortDirection}
                />
              </div>

              {/* Environment Toolbar */}
              <EnvironmentToolbar />

              {/* Error banner (rate limit / generic errors — dismissible, stale data still shown) */}
              {errorBannerMessage && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border-b border-red-500/20 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{errorBannerMessage}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-red-400 hover:bg-red-500/10 shrink-0"
                    onClick={() => refetch()}
                  >
                    Retry
                  </Button>
                  <button
                    onClick={() => setErrorDismissed(true)}
                    className="text-red-400 hover:text-red-300"
                    aria-label="Dismiss error"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Cody Status Banner */}
              <CodyStatusBanner
                tasks={tasks}
                isFetching={isFetching}
                dataUpdatedAt={dataUpdatedAt}
              />

              {/* Task List */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {isLoading && tasks.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-muted-foreground">Loading...</div>
                  </div>
                ) : viewMode === 'queue' ? (
                  <QueueView
                    tasks={filteredTasks}
                    onTaskSelect={handleTaskSelect}
                    onRemoveFromQueue={(issueNumber) => {
                      tasksApi.removeFromQueue(issueNumber, githubUser?.login).then(() => {
                        toast.success('Removed from queue')
                        refetch()
                      })
                    }}
                    onRetry={(taskId) => handleExecuteTask(taskId)}
                    selectedTask={selectedTask}
                  />
                ) : (
                  <TaskList
                    tasks={filteredTasks}
                    selectedTask={selectedTask}
                    executingTaskId={executingTaskId}
                    mergingTaskId={mergingTaskId}
                    focusedIndex={focusedIndex}
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
                    onOpenPreview={handleOpenPreview}
                    onCreateTask={handleOpenCreate}
                    onEditTask={setEditingTask}
                    onDuplicate={handleDuplicateTask}
                    onToggleQueue={(task) => {
                      const isQueued = task.labels.includes('cody:queued')
                      const action = isQueued
                        ? tasksApi.removeFromQueue(task.issueNumber, githubUser?.login)
                        : tasksApi.addToQueue(task.issueNumber, githubUser?.login)
                      action.then(() => {
                        toast.success(isQueued ? 'Removed from queue' : 'Added to queue')
                        refetch()
                      })
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Desktop: Chat Panel (right side, always visible) */}
        <div className="hidden md:block w-[400px] border-l border-border">
          <CodyChat selectedTask={selectedTask} actorLogin={githubUser?.login} />
        </div>

        {/* Mobile Menu Sheet */}
        <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
          <SheetContent side="right" className="w-[280px] p-0">
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription className="sr-only">
                Dashboard controls and filters
              </SheetDescription>
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
                  handleOpenChat()
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
                <a
                  href={SITE_URLS.prod}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
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
                    handleOpenBug()
                  }}
                >
                  <Bug className="w-4 h-4" />
                  Report Bug
                </Button>
                <Button
                  className="w-full"
                  onClick={() => {
                    setShowMobileMenu(false)
                    handleOpenCreate()
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
                onEditTask={setEditingTask}
                onDuplicate={handleDuplicateTask}
              />
            </SheetContent>
          </Sheet>
        )}

        {/* Mobile Chat Sheet — only rendered on mobile */}
        {!isDesktop && (
          <Sheet open={showMobileChat} onOpenChange={handleCloseChat}>
            <SheetContent side="right" className="w-full sm:w-[400px] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Chat with Cody</SheetTitle>
                <SheetDescription>AI assistant chat</SheetDescription>
              </SheetHeader>
              <CodyChat selectedTask={selectedTask} actorLogin={githubUser?.login} />
            </SheetContent>
          </Sheet>
        )}

        {/* Create Dialog */}
        <CreateTaskDialog
          open={showCreateDialog}
          onClose={handleCloseCreate}
          onCreated={refetch}
          initialData={
            duplicateSource
              ? {
                  title: duplicateSource.title,
                  body: duplicateSource.body,
                  labels: duplicateSource.labels,
                  assignees: duplicateSource.assignees?.map((a) => a.login),
                }
              : undefined
          }
        />

        {/* Edit Task Dialog */}
        <EditTaskDialog
          open={!!editingTask}
          onClose={() => setEditingTask(null)}
          task={editingTask}
          onSaved={() => {
            refetch()
            setEditingTask(null)
          }}
        />

        {/* Bug Report Dialog */}
        <BugReportDialog open={showBugDialog} onClose={handleCloseBug} onCreated={refetch} />

        {/* Keyboard Shortcuts Dialog */}
        <KeyboardShortcutsDialog
          open={showShortcutsHelp}
          onClose={() => setShowShortcutsHelp(false)}
        />

        {/* Branch Cleanup Dialog */}
        <BranchCleanupDialog open={showBranchCleanup} onClose={() => setShowBranchCleanup(false)} />
      </div>
    </ErrorBoundary>
  )
}
