/**
 * @fileType hooks
 * @domain cody
 * @pattern custom-hooks
 * @ai-summary React Query hooks for Cody dashboard data fetching
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { codyApi, RateLimitError, NoTokenError } from '../api'
import type { CodyTask } from '../types'
import { POLLING_INTERVALS } from '../constants'

// Query keys
export const queryKeys = {
  tasks: (days?: number, includeDetails?: boolean) => ['cody-tasks', days, includeDetails] as const,
  taskDetails: (issueNumber: number) => ['cody-task', issueNumber] as const,
  boards: ['cody-boards'] as const,
  collaborators: ['cody-collaborators'] as const,
}

// ============ useCodyTasks ============

export interface UseCodyTasksOptions {
  days?: number
  includeDetails?: boolean
  /**
   * Auto-refresh interval based on task state.
   * - 'auto': Uses smart polling based on running tasks
   * - 'idle': 60s interval when no tasks are running
   * - 'board': 30s interval when tasks are on board
   * - 'active': 15s interval when viewing active task
   * - false: Disable auto-refresh
   */
  refetchInterval?: 'auto' | 'idle' | 'board' | 'active' | false
}

/**
 * Determine polling interval based on current task data.
 * - Active tasks (building/retrying/gate-waiting): poll every 30s
 * - All idle: poll every 60s
 */
function getSmartInterval(tasks: CodyTask[] | undefined): number {
  if (!tasks || tasks.length === 0) return POLLING_INTERVALS.idle

  const hasActive = tasks.some(
    (t) => t.column === 'building' || t.column === 'retrying' || t.column === 'gate-waiting',
  )

  return hasActive ? POLLING_INTERVALS.board : POLLING_INTERVALS.idle
}

export function useCodyTasks(options: UseCodyTasksOptions = {}) {
  const { days, includeDetails = false, refetchInterval = 'auto' } = options

  return useQuery({
    queryKey: queryKeys.tasks(days, includeDetails),
    queryFn: () => codyApi.tasks.list({ days, includeDetails }),
    refetchInterval: (query): number | false => {
      if (refetchInterval === false) return false

      // Smart auto mode: inspect data to decide interval
      if (refetchInterval === 'auto') {
        return getSmartInterval(query.state.data)
      }

      return POLLING_INTERVALS[refetchInterval]
    },
    refetchIntervalInBackground: false, // Don't poll when tab is hidden
    refetchOnWindowFocus: 'always', // Refresh when user tabs back (even if not stale)
    staleTime: 30_000, // 30s — prevents rapid re-fetches from invalidations; polling handles freshness
    retry: (failureCount, error) => {
      if (error instanceof RateLimitError) return false
      if (error instanceof NoTokenError) return false
      return failureCount < 3
    },
  })
}

// ============ useCodyBoards ============

export function useCodyBoards() {
  return useQuery({
    queryKey: queryKeys.boards,
    queryFn: () => codyApi.boards.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ============ useCollaborators ============

export function useCollaborators() {
  return useQuery({
    queryKey: queryKeys.collaborators,
    queryFn: () => codyApi.collaborators.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ============ useTaskDetails ============

export function useTaskDetails(issueNumber: number | null, actorLogin?: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.taskDetails(issueNumber ?? -1),
    queryFn: () => codyApi.tasks.get(issueNumber!),
    enabled: !!issueNumber,
    staleTime: 60_000, // 60s — assignee updates are reflected via list polling; detail is fetched on select
  })

  // Mutations for task actions — only invalidate the detail query, not the task list.
  // The task list refreshes via polling; double-invalidation wastes API quota.
  const executeMutation = useMutation({
    mutationFn: () => codyApi.tasks.execute(issueNumber!, actorLogin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskDetails(issueNumber!) })
    },
  })

  const closeMutation = useMutation({
    mutationFn: () => codyApi.tasks.close(issueNumber!, actorLogin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskDetails(issueNumber!) })
    },
  })

  const reopenMutation = useMutation({
    mutationFn: () => codyApi.tasks.reopen(issueNumber!, actorLogin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskDetails(issueNumber!) })
    },
  })

  const abortMutation = useMutation({
    mutationFn: () => codyApi.tasks.abort(issueNumber!, actorLogin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskDetails(issueNumber!) })
    },
  })

  return {
    ...query,
    execute: executeMutation.mutate,
    close: closeMutation.mutate,
    reopen: reopenMutation.mutate,
    abort: abortMutation.mutate,
    isExecuting: executeMutation.isPending,
    isClosing: closeMutation.isPending,
    isReopening: reopenMutation.isPending,
    isAborting: abortMutation.isPending,
  }
}

// ============ useCreateTask ============

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      title: string
      body: string
      mode: string
      labels?: string[]
      assignees?: string[]
      attachments?: Array<{ name: string; content: string }>
      actorLogin?: string
    }) => codyApi.tasks.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
    },
  })
}

// ============ usePostComment ============

export function usePostComment(issueNumber: number, actorLogin?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (comment: string) => codyApi.tasks.comment(issueNumber, comment, actorLogin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskDetails(issueNumber) })
    },
  })
}

// ============ useRetryWithContext ============

export interface UseRetryWithContextOptions {
  issueNumber: number
  actorLogin?: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function useRetryWithContext({
  issueNumber,
  actorLogin,
  onSuccess,
  onError,
}: UseRetryWithContextOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (context: string) => {
      // First post the comment with @cody retry and context
      await codyApi.tasks.retryWithContext(issueNumber, context, actorLogin)
      // Then trigger execution
      await codyApi.tasks.execute(issueNumber, actorLogin)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
      onSuccess?.()
    },
    onError,
  })
}

// ============ useTaskActions ============

export interface UseTaskActionsOptions {
  issueNumber: number
  actorLogin?: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}

/**
 * Hook providing all task action mutations with per-action pending states
 * and toast notifications for user feedback.
 */
export function useTaskActions({
  issueNumber,
  actorLogin,
  onSuccess,
  onError,
}: UseTaskActionsOptions) {
  const queryClient = useQueryClient()

  const handleError = (label: string) => (error: Error) => {
    toast.error(`Failed to ${label}`, { description: error.message })
    onError?.(error)
  }

  const handleSuccess = (label: string) => () => {
    // Only invalidate the specific task detail — task list refreshes via polling.
    // This prevents mutations from triggering 3+ GitHub API calls per action.
    queryClient.invalidateQueries({ queryKey: queryKeys.taskDetails(issueNumber) })
    toast.success(label)
    onSuccess?.()
  }

  const execute = useMutation({
    mutationFn: () => codyApi.tasks.execute(issueNumber, actorLogin),
    onSuccess: handleSuccess('Task started'),
    onError: handleError('start task'),
  })

  const close = useMutation({
    mutationFn: () => codyApi.tasks.close(issueNumber, actorLogin),
    onSuccess: handleSuccess('Issue closed'),
    onError: handleError('close issue'),
  })

  const reopen = useMutation({
    mutationFn: () => codyApi.tasks.reopen(issueNumber, actorLogin),
    onSuccess: handleSuccess('Issue reopened'),
    onError: handleError('reopen issue'),
  })

  const abort = useMutation({
    mutationFn: () => codyApi.tasks.abort(issueNumber, actorLogin),
    onSuccess: handleSuccess('Task stopped'),
    onError: handleError('stop task'),
  })

  const closePR = useMutation({
    mutationFn: () => codyApi.tasks.closePR(issueNumber, actorLogin),
    onSuccess: handleSuccess('PR closed'),
    onError: handleError('close PR'),
  })

  const reset = useMutation({
    mutationFn: () => codyApi.tasks.reset(issueNumber, actorLogin),
    onSuccess: handleSuccess('Task reset successfully'),
    onError: handleError('reset task'),
  })

  const approveGate = useMutation({
    mutationFn: () => codyApi.tasks.approveGate(issueNumber, actorLogin),
    onSuccess: handleSuccess('Gate approved'),
    onError: handleError('approve gate'),
  })

  const rejectGate = useMutation({
    mutationFn: () => codyApi.tasks.rejectGate(issueNumber, actorLogin),
    onSuccess: handleSuccess('Gate rejected'),
    onError: handleError('reject gate'),
  })

  const assign = useMutation({
    mutationFn: (assignees: string[]) => codyApi.tasks.assign(issueNumber, assignees, actorLogin),
    onSuccess: handleSuccess('User(s) assigned'),
    onError: handleError('assign user'),
  })

  const unassign = useMutation({
    mutationFn: (assignees: string[]) => codyApi.tasks.unassign(issueNumber, assignees, actorLogin),
    onSuccess: handleSuccess('User(s) unassigned'),
    onError: handleError('unassign user'),
  })

  const isPending =
    execute.isPending ||
    close.isPending ||
    closePR.isPending ||
    reset.isPending ||
    reopen.isPending ||
    abort.isPending ||
    approveGate.isPending ||
    rejectGate.isPending ||
    assign.isPending ||
    unassign.isPending

  return {
    execute: execute.mutate,
    close: close.mutate,
    closePR: closePR.mutate,
    reset: reset.mutate,
    reopen: reopen.mutate,
    abort: abort.mutate,
    approveGate: approveGate.mutate,
    rejectGate: rejectGate.mutate,
    assign: assign.mutate,
    unassign: unassign.mutate,
    isPending,
    pendingAction: execute.isPending
      ? 'execute'
      : abort.isPending
        ? 'abort'
        : approveGate.isPending
          ? 'approve'
          : rejectGate.isPending
            ? 'reject'
            : close.isPending
              ? 'close'
              : closePR.isPending
                ? 'close-pr'
                : reset.isPending
                  ? 'reset'
                  : reopen.isPending
                    ? 'reopen'
                    : null,
  }
}
