/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern copilotkit-runtime
 * @ai-summary CopilotKit runtime endpoint for AI chat in Cody dashboard
 */
import '@/infra/config/server-init'

import OpenAI from 'openai'
import { GoogleGenerativeAIAdapter, OpenAIAdapter } from '@copilotkit/runtime'
import { CopilotRuntime } from '@copilotkit/runtime/v2'
import { InMemoryAgentRunner } from '@copilotkit/runtime/v2'
import { logger } from '@/infra/utils/logger/logger'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

// Create the CopilotRuntime instance with proper configuration
const copilotKit = new CopilotRuntime({
  runner: new InMemoryAgentRunner(),
  agents: {},
})

// Determine which adapter to use based on available API keys
const geminiApiKey = process.env.GEMINI_API_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

let serviceAdapter: GoogleGenerativeAIAdapter | OpenAIAdapter | null = null

if (geminiApiKey) {
  // Use GoogleGenerativeAIAdapter with GEMINI_API_KEY
  logger.info({ adapter: 'GoogleGenerativeAIAdapter' }, 'Using Gemini adapter')
  serviceAdapter = new GoogleGenerativeAIAdapter({ apiKey: geminiApiKey })
} else if (openaiApiKey) {
  // Use OpenAIAdapter with OPENAI_API_KEY
  logger.info({ adapter: 'OpenAIAdapter' }, 'Using OpenAI adapter')
  const openai = new OpenAI({ apiKey: openaiApiKey })
  serviceAdapter = new OpenAIAdapter({ openai })
}

export async function GET() {
  return NextResponse.json({ status: 'CopilotKit endpoint ready' })
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    logger.info({ requestId }, 'CopilotKit request received')

    // Env validation: Check that at least one of GEMINI_API_KEY or OPENAI_API_KEY is set
    if (!geminiApiKey && !openaiApiKey) {
      logger.warn({ requestId }, 'No LLM API key configured for CopilotKit')
      return NextResponse.json(
        {
          error: 'No LLM API key configured. Please set GEMINI_API_KEY or OPENAI_API_KEY.',
          requestId,
        },
        { status: 503 },
      )
    }

    if (!serviceAdapter) {
      return NextResponse.json(
        {
          error: 'No LLM adapter available',
          requestId,
        },
        { status: 500 },
      )
    }

    // Handle the request through CopilotRuntime with the adapter
    // @ts-expect-error - handleServiceAdapter exists at runtime but types are incomplete
    const response = await copilotKit.handleServiceAdapter(request, serviceAdapter)

    return response
  } catch (error) {
    logger.error({ err: error, requestId }, 'CopilotKit route error')
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        requestId,
      },
      { status: 500 },
    )
  }
}
