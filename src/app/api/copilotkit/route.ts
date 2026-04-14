/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern copilotkit-runtime
 * @ai-summary Simple AI chat endpoint for Cody dashboard (authenticated)
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { logger } from '@/infra/utils/logger/logger'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { withApiHandler } from '@/server/api/with-api-handler'

// Use Node.js runtime because we use GoogleGenerativeAI
export const runtime = 'nodejs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Fetch full dashboard context including issue content
async function getDashboardContext() {
  try {
    const GITHUB_OWNER = process.env.GITHUB_OWNER || 'A-Guy-educ'
    const GITHUB_REPO = process.env.GITHUB_REPO || 'A-Guy'
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN

    if (!GITHUB_TOKEN) {
      return null
    }

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?state=all&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    )

    if (!res.ok) {
      return null
    }

    const issues = await res.json()

    // Calculate stats
    const stats = {
      total: issues.length,
      open: issues.filter((i: { state: string }) => i.state === 'open').length,
      closed: issues.filter((i: { state: string }) => i.state === 'closed').length,
      labels: {} as Record<string, number>,
    }

    // Count labels and build issue list
    const issueList: string[] = []

    for (const issue of issues) {
      for (const label of issue.labels || []) {
        const name = typeof label === 'string' ? label : label.name
        stats.labels[name] = (stats.labels[name] || 0) + 1
      }

      // Build issue summary
      const labels = (issue.labels || [])
        .map((l: { name?: string }) => (typeof l === 'string' ? l : l.name))
        .join(', ')
      const assignees =
        (issue.assignees || [])
          .map((a: { login?: string }) => (typeof a === 'string' ? a : a.login))
          .join(', ') || 'unassigned'

      issueList.push(
        `#${issue.number}: "${issue.title}" [${issue.state}] labels: ${labels || 'none'} assignees: ${assignees}`,
      )
    }

    // Top labels
    const topLabels = Object.entries(stats.labels)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => `${name} (${count})`)

    return { stats, topLabels, issueList }
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch dashboard context')
    return null
  }
}

export const GET = withApiHandler<unknown, unknown>(
  { auth: 'public' },
  async () => {
    return NextResponse.json({ status: 'Chat endpoint ready' })
  },
)

const chatBodySchema = z.object({
  message: z.string().min(1, 'Message is required'),
  history: z
    .array(
      z.object({
        role: z.string(),
        content: z.string(),
      }),
    )
    .default([]),
})

type ChatBody = z.infer<typeof chatBodySchema>

export const POST = withApiHandler<ChatBody, unknown>(
  {
    auth: 'authenticated',
    bodySchema: chatBodySchema,
  },
  async ({ body }) => {
    const requestId = crypto.randomUUID()

    try {
      const geminiApiKey = process.env.GEMINI_API_KEY
      if (!geminiApiKey) {
        return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 503 })
      }

      const { message, history } = body

      logger.info({ requestId, message: message.slice(0, 100) }, 'Chat request received')

      // Get full dashboard context
      const dashboardData = await getDashboardContext()

      // Build system prompt with dashboard context
      const systemPrompt = `You are a helpful assistant for the Cody Operations Dashboard, which shows GitHub issues from the A-Guy repository.

You help users understand the dashboard, manage issues, and answer questions about the project.

${
  dashboardData
    ? `Current Dashboard Stats:
- Total issues: ${dashboardData.stats.total}
- Open issues: ${dashboardData.stats.open}
- Closed issues: ${dashboardData.stats.closed}
- Top labels: ${dashboardData.topLabels.join(', ')}

Here are all the issues in the dashboard:
${dashboardData.issueList.slice(0, 50).join('\n')}

Use this information to answer questions about specific issues!`
    : `Note: Could not fetch live dashboard data. Answer based on general knowledge.`
}

When answering:
- Be specific - use issue numbers and titles when answering questions
- If asked about specific issues, you can reference them by their number (#123)
- If asked to create/manage issues, users can use the "+ New Task" button in the dashboard
- You can help explain what different columns mean (Open, Building, Done, etc.)`

      // Create chat with history
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
      })

      // Create chat with history
      const chat = model.startChat({
        history: history.map((msg: { role: string; content: string }) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        })),
      })

      // Send message
      const result = await chat.sendMessage(message)
      const response = result.response
      const text = response.text()

      return NextResponse.json({
        response: text,
        requestId,
      })
    } catch (error) {
      const { captureAndRespond } = await import('@/server/api/capture-and-respond')
      return captureAndRespond(error, { route: '/api/copilotkit', requestId })
    }
  },
)
