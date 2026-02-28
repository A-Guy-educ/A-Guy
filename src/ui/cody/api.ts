/**
 * @fileType utility
 * @domain cody
 * @pattern api-client
 * @ai-summary Typed API client for Cody dashboard
 */

import type {
  CodyTask,
  Board,
  GitHubCollaborator,
  TasksResponse,
  BoardsResponse,
  CollaboratorsResponse,
  ActionResponse,
} from './types'

const API_BASE = '/api/cody'

// ============ Error Types ============

export class RateLimitError extends Error {
  retryAfter: string | null
  resetTime: string | null

  constructor(message: string, retryAfter?: string, resetTime?: string) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter ?? null
    this.resetTime = resetTime ?? null
  }
}

export class NoTokenError extends Error {
  constructor(message = 'GITHUB_TOKEN is not configured') {
    super(message)
    this.name = 'NoTokenError'
  }
}

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

// ============ Helpers ============

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json()

  if (res.status === 429) {
    throw new RateLimitError(
      data.message || 'Rate limited',
      data.retryAfter ?? undefined,
      data.resetTime ?? undefined,
    )
  }

  if (res.status === 401) {
    throw new NoTokenError(data.message)
  }

  if (!res.ok) {
    throw new ApiError(data.error || 'Request failed', res.status, data)
  }

  return data as T
}

// ============ Tasks API ============

export const tasksApi = {
  list: async (params?: { days?: number; includeDetails?: boolean }): Promise<CodyTask[]> => {
    const searchParams = new URLSearchParams()
    if (params?.days) searchParams.set('days', String(params.days))
    if (params?.includeDetails === false) searchParams.set('includeDetails', 'false')

    const url = `${API_BASE}/tasks${searchParams.toString() ? `?${searchParams}` : ''}`
    const res = await fetch(url)
    const data = await handleResponse<TasksResponse>(res)
    return data.tasks
  },

  get: async (issueNumber: number): Promise<{ task: CodyTask; comments: unknown[] }> => {
    const res = await fetch(`${API_BASE}/tasks/issue-${issueNumber}`)
    return handleResponse(res)
  },

  create: async (data: {
    title: string
    body: string
    mode: string
    labels?: string[]
    assignees?: string[]
  }): Promise<CodyTask> => {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse(res)
  },

  execute: async (issueNumber: number): Promise<ActionResponse> => {
    const res = await fetch(`${API_BASE}/tasks/issue-${issueNumber}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'execute' }),
    })
    return handleResponse(res)
  },

  close: async (issueNumber: number): Promise<ActionResponse> => {
    const res = await fetch(`${API_BASE}/tasks/issue-${issueNumber}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close' }),
    })
    return handleResponse(res)
  },

  reopen: async (issueNumber: number): Promise<ActionResponse> => {
    const res = await fetch(`${API_BASE}/tasks/issue-${issueNumber}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reopen' }),
    })
    return handleResponse(res)
  },

  abort: async (issueNumber: number): Promise<ActionResponse> => {
    const res = await fetch(`${API_BASE}/tasks/issue-${issueNumber}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'abort' }),
    })
    return handleResponse(res)
  },

  comment: async (issueNumber: number, comment: string): Promise<ActionResponse> => {
    const res = await fetch(`${API_BASE}/tasks/issue-${issueNumber}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'comment', comment }),
    })
    return handleResponse(res)
  },

  approve: async (task: CodyTask): Promise<ActionResponse> => {
    if (!task.associatedPR) {
      throw new Error('No PR associated with this task')
    }
    const res = await fetch(`${API_BASE}/tasks/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueNumber: task.issueNumber,
        prNumber: task.associatedPR.number,
        branchName: task.associatedPR.head.ref,
      }),
    })
    return handleResponse(res)
  },

  approveReview: async (task: CodyTask): Promise<ActionResponse> => {
    if (!task.associatedPR) {
      throw new Error('No PR associated with this task')
    }
    const res = await fetch(`${API_BASE}/tasks/approve-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prNumber: task.associatedPR.number,
      }),
    })
    return handleResponse(res)
  },
}

// ============ Boards API ============

export const boardsApi = {
  list: async (): Promise<Board[]> => {
    const res = await fetch(`${API_BASE}/boards`)
    const data = await handleResponse<BoardsResponse>(res)
    return data.boards
  },
}

// ============ Collaborators API ============

export const collaboratorsApi = {
  list: async (): Promise<GitHubCollaborator[]> => {
    const res = await fetch(`${API_BASE}/collaborators`)
    const data = await handleResponse<CollaboratorsResponse>(res)
    return data.collaborators
  },
}

// ============ Combined API ============

export const codyApi = {
  tasks: tasksApi,
  boards: boardsApi,
  collaborators: collaboratorsApi,
}
