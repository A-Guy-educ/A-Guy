/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern copilotkit-runtime
 * @ai-summary CopilotKit runtime endpoint for AI chat in Cody dashboard
 */
import { GoogleGenerativeAIAdapter, OpenAIAdapter } from '@copilotkit/runtime'
import { NextRequest, NextResponse } from 'next/server'

const geminiApiKey = process.env.GEMINI_API_KEY
const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY

export async function POST(_req: NextRequest) {
  // Check for API key availability
  if (!geminiApiKey && !openaiApiKey) {
    return NextResponse.json(
      { error: 'No AI API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY.' },
      { status: 503 },
    )
  }

  // Determine which adapter to use based on available API keys
  // Priority: Gemini > OpenAI
  let serviceAdapter: GoogleGenerativeAIAdapter | OpenAIAdapter | null = null

  if (geminiApiKey) {
    console.log('[CopilotKit] Using Gemini adapter')
    serviceAdapter = new GoogleGenerativeAIAdapter({
      apiKey: geminiApiKey,
      model: 'gemini-2.0-flash',
    })
  } else if (openaiApiKey) {
    console.log('[CopilotKit] Using OpenAI adapter')
    serviceAdapter = new OpenAIAdapter({
      model: 'gpt-4o',
    })
  }

  if (!serviceAdapter) {
    return NextResponse.json({ error: 'Failed to initialize AI adapter' }, { status: 500 })
  }

  try {
    // For now, return a simple response indicating the endpoint is ready
    // The full implementation requires more setup with the GraphQL layer
    return NextResponse.json({
      status: 'CopilotKit endpoint ready',
      adapter: geminiApiKey ? 'gemini' : openaiApiKey ? 'openai' : 'none',
      message: 'Configure CopilotKit client components to connect to this endpoint',
    })
  } catch (error) {
    console.error('[CopilotKit] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({ status: 'CopilotKit endpoint ready' })
}
