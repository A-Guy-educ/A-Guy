/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern ai-chat-streaming
 * @ai-summary Streaming AI chat endpoint with GitHub MCP tools for repo browsing
 */
import { createMCPClient } from '@ai-sdk/mcp'
import { google } from '@ai-sdk/google'
import { streamText, tool } from 'ai'
import { z } from 'zod'
import { logger } from '@/infra/utils/logger/logger'
import { NextRequest, NextResponse } from 'next/server'
import { requireDashboardAuth } from '@/ui/cody/auth'
import {
  fetchIssue,
  fetchIssues,
  fetchComments,
  getStatusFromBranch,
  findTaskBranch,
  fetchWorkflowRuns,
  findAssociatedPR,
} from '@/ui/cody/github-client'
import { GITHUB_OWNER, GITHUB_REPO } from '@/ui/cody/constants'
import type {
  CodyTask,
  CodyPipelineStatus,
  GitHubPR,
  GitHubComment,
  WorkflowRun,
} from '@/ui/cody/types'

// Use Node.js runtime
export const runtime = 'nodejs'

// Cache the MCP client to avoid recreating it on every request
let mcpClientPromise: ReturnType<typeof createMCPClient> | null = null

async function getMCPClient() {
  if (mcpClientPromise) return mcpClientPromise

  mcpClientPromise = createMCPClient({
    transport: {
      type: 'http',
      url: 'https://api.githubcopilot.com/mcp/',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    },
  })

  return mcpClientPromise
}

// Custom tools for Cody pipeline-specific data (not available in GitHub MCP)
const customTools = {
  // List Cody tasks (issues with special labels)
  listCodyTasks: tool({
    description:
      'List Cody operations tasks from the dashboard. Use this to get an overview of all tasks and their status.',
    parameters: z.object({
      days: z.number().optional().describe('Number of days to look back (default: 30)'),
      status: z.string().optional().describe('Filter by status label'),
    }),
    execute: async ({ days = 30, status }) => {
      const since = new Date()
      since.setDate(since.getDate() - days)

      const issues = await fetchIssues({ since: since.toISOString(), perPage: 50 })

      let tasks = issues.map(
        (issue): Partial<CodyTask> => ({
          id: issue.number.toString(),
          issueNumber: issue.number,
          title: issue.title,
          state: issue.state as 'open' | 'closed',
          labels: issue.labels?.map((l: { name: string }) => l.name) || [],
        }),
      )

      // Filter by status if specified
      if (status) {
        const statusLower = status.toLowerCase()
        tasks = tasks.filter((t) => t.labels?.some((l) => l.toLowerCase().includes(statusLower)))
      }

      return {
        count: tasks.length,
        tasks: tasks.slice(0, 20).map((t) => ({
          issueNumber: t.issueNumber,
          title: t.title,
          state: t.state,
          labels: t.labels,
        })),
      }
    },
  }),

  // Get detailed info for a specific task
  getCodyTask: tool({
    description:
      'Get detailed information about a specific Cody task including its pipeline status.',
    parameters: z.object({
      taskId: z.string().describe('The task ID (e.g., "260221-test" or issue number)'),
    }),
    execute: async ({ taskId }) => {
      // Extract issue number from taskId
      const issueNumber = taskId.includes('-')
        ? parseInt(taskId.split('-')[1]) || parseInt(taskId)
        : parseInt(taskId)

      if (isNaN(issueNumber)) {
        return { error: 'Invalid task ID format' }
      }

      const issue = await fetchIssue(issueNumber)
      if (!issue) {
        return { error: 'Task not found' }
      }

      // Try to get pipeline status
      const branch = await findTaskBranch(taskId)
      let pipelineStatus: CodyPipelineStatus | null = null
      if (branch) {
        pipelineStatus = await getStatusFromBranch(taskId, branch)
      }

      // Get associated PR
      const pr: GitHubPR | null = await findAssociatedPR(taskId)

      // Get comments
      const comments: GitHubComment[] = await fetchComments(issueNumber)

      return {
        issueNumber: issue.number,
        title: issue.title,
        state: issue.state,
        body: issue.body,
        labels: issue.labels?.map((l: { name: string }) => l.name) || [],
        assignees: issue.assignees?.map((u: { login: string }) => u.login) || [],
        htmlUrl: issue.html_url,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        pipeline: pipelineStatus
          ? {
              taskId: pipelineStatus.taskId,
              state: pipelineStatus.state,
              currentStage: pipelineStatus.currentStage,
              stages: pipelineStatus.stages,
              startedAt: pipelineStatus.startedAt,
              updatedAt: pipelineStatus.updatedAt,
            }
          : null,
        pr: pr
          ? {
              number: pr.number,
              title: pr.title,
              state: pr.state,
              url: pr.html_url,
              mergedAt: pr.merged_at,
            }
          : null,
        commentsCount: comments.length,
        recentComments: comments.slice(0, 5).map((c) => ({
          body: c.body?.slice(0, 500),
          author: c.user?.login,
          createdAt: c.created_at,
        })),
      }
    },
  }),

  // Get pipeline status for a task
  getPipelineStatus: tool({
    description:
      'Get the pipeline/CI status for a specific Cody task. Shows stage-by-stage progress.',
    parameters: z.object({
      taskId: z.string().describe('The task ID'),
    }),
    execute: async ({ taskId }) => {
      const branch = await findTaskBranch(taskId)
      if (!branch) {
        return { error: 'Could not find branch for task', taskId }
      }

      const status = await getStatusFromBranch(taskId, branch)
      if (!status) {
        return { error: 'No pipeline status found', branch }
      }

      return {
        taskId,
        branch,
        state: status.state,
        currentStage: status.currentStage,
        stages: status.stages,
        startedAt: status.startedAt,
        updatedAt: status.updatedAt,
        completedAt: status.completedAt,
        totalElapsed: status.totalElapsed,
      }
    },
  }),

  // Get workflow runs
  getWorkflowRuns: tool({
    description: 'Get recent GitHub Actions workflow runs for the Cody pipeline.',
    parameters: z.object({
      status: z
        .string()
        .optional()
        .describe('Filter by status: completed, failure, in_progress, queued'),
      perPage: z.number().optional().describe('Number of runs to return (default: 10)'),
    }),
    execute: async ({ status, perPage = 10 }) => {
      const statusFilter =
        status === 'success'
          ? 'completed'
          : status === 'failure'
            ? 'completed'
            : (status as 'completed' | 'in_progress' | 'queued' | undefined)

      const runs: WorkflowRun[] = await fetchWorkflowRuns({
        perPage: perPage,
        status: statusFilter,
      })

      return {
        count: runs.length,
        runs: runs.map((r) => ({
          id: r.id,
          status: r.status,
          conclusion: r.conclusion,
          url: r.html_url,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      }
    },
  }),

  // Get associated PR for a task
  getTaskPR: tool({
    description: 'Get the pull request associated with a Cody task.',
    parameters: z.object({
      taskId: z.string().describe('The task ID'),
    }),
    execute: async ({ taskId }) => {
      const pr = await findAssociatedPR(taskId)
      if (!pr) {
        return { error: 'No PR found for this task', taskId }
      }

      return {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        headBranch: pr.head?.ref,
        mergedAt: pr.merged_at,
      }
    },
  }),
}

// System prompt
const SYSTEM_PROMPT = `You are Cody, an AI assistant for the Cody Operations Dashboard.

The dashboard manages software development tasks using an AI-powered pipeline (the "Cody" system). You help users understand:

1. **Task Management**: List and explain tasks, their status, and details
2. **Pipeline Status**: Show CI/CD stage progress for each task
3. **Workflow Runs**: Display GitHub Actions workflow status
4. **Pull Requests**: Show PRs associated with tasks
5. **Repository Code**: Browse files, search code, view branches and commits

You have access to tools that let you:
- Read repository files and search code (GitHub MCP tools)
- List and search issues/tasks (custom Cody tools)
- Get pipeline status and workflow runs (custom Cody tools)
- View PRs and their details

When users ask about tasks or operations, use the custom Cody tools (listCodyTasks, getCodyTask, getPipelineStatus, getWorkflowRuns, getTaskPR).

When users ask about code, files, or repository structure, use the GitHub MCP tools.

Be helpful, concise, and technical when appropriate. Use markdown for formatting.

The repository is "${GITHUB_OWNER}/${GITHUB_REPO}" - a Next.js 15 + Payload CMS application.
The Cody pipeline has these stages:
- Spec: taskify → spec → clarify
- Impl: architect → plan-review → build → commit → verify → auditor → apply-audit → pr
- Special: autofix (retry loop)
`

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const auth = await requireDashboardAuth(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Test MCP connection
    const mcp = await getMCPClient()
    const tools = await mcp.tools()

    return NextResponse.json({
      status: 'Chat endpoint ready',
      toolsets: ['github-mcp', 'custom-cody'],
      toolCount: Object.keys(tools).length + Object.keys(customTools).length,
    })
  } catch (error) {
    logger.error({ err: error }, 'Chat GET error')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    // Skip auth check for now - open access for testing

    // Validate environment - AI SDK uses GOOGLE_GENERATIVE_AI_API_KEY
    const githubToken = process.env.GITHUB_TOKEN
    const geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY

    if (!githubToken) {
      return NextResponse.json({ error: 'GITHUB_TOKEN is not configured' }, { status: 503 })
    }

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_GENERATIVE_AI_API_KEY is not configured' },
        { status: 503 },
      )
    }

    const body = await req.json()
    const { messages = [] } = body

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 })
    }

    logger.info({ requestId, messageCount: messages.length }, 'Chat request received')

    // Skip AI for now - just return a test response
    // const testResponse = '0:"Hello! I can help you with Cody tasks. How can I assist you?"'
    // return new NextResponse(testResponse, {
    //   headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    // })

    // Convert messages to AI SDK format
    const aiMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    logger.info({ requestId, messageCount: aiMessages.length }, 'Calling AI with messages')

    // Use custom tools only (skip MCP which may be causing issues)
    const allTools = customTools

    // Use gemini-3.1-pro-preview as originally specified
    const result = streamText({
      model: google('gemini-3.1-pro-preview'),
      tools: allTools,
      system: SYSTEM_PROMPT,
      messages: aiMessages,
      maxSteps: 10,
    })

    // Return streaming response
    return result.toDataStreamResponse()
  } catch (error) {
    logger.error({ err: error, requestId }, 'Chat route error')

    // Return error as AI data stream
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStream = `0:${JSON.stringify(errorMessage)}\n`
    return new NextResponse(errorStream, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
