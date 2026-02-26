/**
 * @fileType hooks
 * @domain cody
 * @pattern custom-hooks
 * @ai-summary React Query hooks for Cody dashboard data fetching
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { codyApi, RateLimitError, NoTokenError } from '../api'
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
   * - 'idle': 30s interval when no tasks are running
   * - 'board': 10s interval when tasks are on board
   * - 'active': 5s interval when viewing active task
   * - false: Disable auto-refresh
   */
  refetchInterval?: 'auto' | 'idle' | 'board' | 'active' | false
}

export function useCodyTasks(options: UseCodyTasksOptions = {}) {
  const { days, includeDetails = false, refetchInterval = 'auto' } = options

  return useQuery({
    queryKey: queryKeys.tasks(days, includeDetails),
    queryFn: () => codyApi.tasks.list({ days, includeDetails }),
    refetchInterval: (): number | false => {
      if (refetchInterval === false || refetchInterval === 'auto') return false

      return POLLING_INTERVALS[refetchInterval]
    },
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

export function useTaskDetails(issueNumber: number | null) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.taskDetails(issueNumber ?? -1),
    queryFn: () => codyApi.tasks.get(issueNumber!),
    enabled: !!issueNumber,
    staleTime: 30 * 1000, // 30 seconds
  })

  // Mutations for task actions
  const executeMutation = useMutation({
    mutationFn: () => codyApi.tasks.execute(issueNumber!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskDetails(issueNumber!) })
      queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
    },
  })

  const closeMutation = useMutation({
    mutationFn: () => codyApi.tasks.close(issueNumber!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskDetails(issueNumber!) })
      queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
    },
  })

  const reopenMutation = useMutation({
    mutationFn: () => codyApi.tasks.reopen(issueNumber!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskDetails(issueNumber!) })
      queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
    },
  })

  const abortMutation = useMutation({
    mutationFn: () => codyApi.tasks.abort(issueNumber!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskDetails(issueNumber!) })
      queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
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
    }) => codyApi.tasks.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
    },
  })
}

// ============ usePostComment ============

export function usePostComment(issueNumber: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (comment: string) => codyApi.tasks.comment(issueNumber, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskDetails(issueNumber) })
    },
  })
}

// ============ useTaskActions ============

export interface UseTaskActionsOptions {
  issueNumber: number
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function useTaskActions({ issueNumber, onSuccess, onError }: UseTaskActionsOptions) {
  const queryClient = useQueryClient()

  const execute = useMutation({
    mutationFn: () => codyApi.tasks.execute(issueNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
      onSuccess?.()
    },
    onError,
  })

  const close = useMutation({
    mutationFn: () => codyApi.tasks.close(issueNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
      onSuccess?.()
    },
    onError,
  })

  const reopen = useMutation({
    mutationFn: () => codyApi.tasks.reopen(issueNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
      onSuccess?.()
    },
    onError,
  })

  const abort = useMutation({
    mutationFn: () => codyApi.tasks.abort(issueNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
      onSuccess?.()
    },
    onError,
  })

  return {
    execute: execute.mutate,
    close: close.mutate,
    reopen: reopen.mutate,
    abort: abort.mutate,
    isPending: execute.isPending || close.isPending || reopen.isPending || abort.isPending,
  }
}
