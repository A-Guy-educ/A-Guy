/**
 * Summary Generation Service
 * Compresses conversation history into concise summaries
 *
 * Key Features:
 * - Uses cheaper model (gpt-4o-mini) for cost efficiency
 * - Preserves key decisions, preferences, and open loops
 * - Updates existing summaries incrementally
 * - Low temperature for deterministic output
 */

import { logger } from '@/infra/utils/logger'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import type { Payload } from 'payload'
import { fileURLToPath } from 'url'
import type { Message } from './context-policy'
import { getOpenAIClient } from './openai-client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Track if we're in test mode (no payload)
let testMode = false

/**
 * Enable test mode - uses process.env.OPENAI_API_KEY directly
 * @internal
 */
export function setSummaryTestMode(enabled: boolean): void {
  testMode = enabled
}

/**
 * Get OpenAI client for summary generation (test-compatible)
 */
async function getSummaryClient(payload?: Payload): Promise<any> {
  // Test mode: use process.env directly
  if (testMode || !payload) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    const { OpenAI } = await import('openai')
    return new OpenAI({ apiKey, dangerouslyAllowBrowser: true })
  }

  // Use tenant-scoped config
  return getOpenAIClient(payload)
}

export interface SummaryResult {
  summary: string
  summaryUntilTimestamp: Date
  tokensUsed: number
}

// Load prompt from external file with a safe fallback so that missing files
// do not crash the agent chat endpoint at module load time (e.g. in serverless environments).
// First tries to load the main prompt file, then falls back to the default file, then to inline default.
let SUMMARY_SYSTEM_PROMPT: string = ''

try {
  const promptPath = join(__dirname, 'prompts/summary-system-prompt.md')
  SUMMARY_SYSTEM_PROMPT = readFileSync(promptPath, 'utf-8')
} catch (error: unknown) {
  logger.warn(
    { err: error, path: join(__dirname, 'prompts/summary-system-prompt.md') },
    '[Summary] Failed to load summary system prompt from markdown file, trying default fallback',
  )

  // Try to load the default fallback file
  try {
    const defaultPath = join(__dirname, 'prompts/summary-system-prompt.default.md')
    SUMMARY_SYSTEM_PROMPT = readFileSync(defaultPath, 'utf-8')
    logger.info('[Summary] Loaded default summary prompt from fallback file')
  } catch (fallbackError: unknown) {
    logger.warn(
      { err: fallbackError },
      '[Summary] Failed to load default fallback file, using inline default',
    )
    // Final fallback: inline default (matches summary-system-prompt.default.md)
    SUMMARY_SYSTEM_PROMPT = [
      'You are a conversation summarizer for an educational chat system.',
      '',
      'Your task is to create a concise, factual summary that preserves:',
      '',
      '- Key decisions made',
      '- User preferences and constraints',
      '- Important facts and context',
      '- Open loops (unresolved questions)',
      '- Learning progress and goals',
      '',
      'Keep the summary under 500 words. Use clear, structured format.',
      'Omit greetings, small talk, and ephemeral content.',
      'Focus on information that will help continue the conversation later.',
    ].join('\n')
  }
}

/**
 * Generate or update conversation summary
 * Returns updated summary text and metadata
 *
 * @param payloadOrSummary - Payload instance OR existing summary string (backward compat)
 * @param existingSummaryOrMessages - Existing summary OR messages array (backward compat)
 * @param messagesToSummarize - Messages array (new signature only)
 */
export async function generateSummary(
  payloadOrSummary: Payload | string,
  existingSummaryOrMessages: string | Message[],
  messagesToSummarize?: Message[],
): Promise<SummaryResult> {
  let payload: Payload | undefined
  let existingSummary: string
  let messages: Message[]

  if (typeof payloadOrSummary === 'string') {
    // Backward compatibility: first arg is existingSummary string
    existingSummary = payloadOrSummary
    messages = existingSummaryOrMessages as Message[]
    payload = undefined
  } else {
    // New signature: first arg is payload
    payload = payloadOrSummary
    existingSummary = typeof existingSummaryOrMessages === 'string' ? existingSummaryOrMessages : ''
    messages = messagesToSummarize || []
  }

  if (messages.length === 0) {
    throw new Error('Cannot summarize empty message list')
  }

  // Build prompt
  const messagesText = messages
    .map((msg) => {
      const timestamp = new Date(msg.timestamp).toISOString()
      return `[${timestamp}] ${msg.role}: ${msg.content}`
    })
    .join('\n\n')

  let userPrompt = ''
  if (existingSummary && existingSummary.trim().length > 0) {
    userPrompt = `Here is the existing summary:\n\n${existingSummary}\n\n---\n\nHere are new messages to incorporate:\n\n${messagesText}\n\n---\n\nPlease update the summary to include the new information.`
  } else {
    userPrompt = `Here are the messages to summarize:\n\n${messagesText}\n\n---\n\nPlease create a summary.`
  }

  try {
    // Call model
    const client = await getSummaryClient(payload)
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Cheaper model is fine for summaries
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // More deterministic
      max_tokens: 1000,
    })

    const summary = response.choices[0].message.content || ''
    const lastMessage = messages[messages.length - 1]

    return {
      summary,
      summaryUntilTimestamp: new Date(lastMessage.timestamp),
      tokensUsed: response.usage?.total_tokens || 0,
    }
  } catch (error) {
    logger.error({ err: error }, '[Summary] Generation failed')
    throw error
  }
}
