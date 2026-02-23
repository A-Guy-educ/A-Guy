/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern copilotkit-runtime
 * @ai-summary Simple AI chat endpoint for Cody dashboard
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { logger } from '@/infra/utils/logger/logger'
import { NextRequest, NextResponse } from 'next/server'

// Use Node.js runtime because we use GoogleGenerativeAI
export const runtime = 'nodejs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function GET() {
  return NextResponse.json({ status: 'Chat endpoint ready' })
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 503 })
    }

    const body = await request.json()
    const { message, history = [] } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    logger.info({ requestId, message: message.slice(0, 100) }, 'Chat request received')

    // Build system prompt
    const systemPrompt = `You are a helpful assistant for the Cody Operations Dashboard. Help users understand the dashboard, manage issues, and answer questions.`

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
    logger.error({ err: error, requestId }, 'Chat route error')
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        requestId,
      },
      { status: 500 },
    )
  }
}
