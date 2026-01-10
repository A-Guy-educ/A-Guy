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

import { OpenAI } from 'openai'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { logger } from '@/utilities/logger'
import type { Message } from './context-policy'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Lazy initialization to avoid errors at module load time
let openai: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      dangerouslyAllowBrowser: true, // Safe in Node.js/test environment
    })
  }
  return openai
}

export interface SummaryResult {
  summary: string
  summaryUntilTimestamp: Date
  tokensUsed: number
}

// Load prompt from external file
const SUMMARY_SYSTEM_PROMPT = readFileSync(
  join(__dirname, 'prompts/summary-system-prompt.md'),
  'utf-8',
)

/**
 * Generate or update conversation summary
 * Returns updated summary text and metadata
 */
export async function generateSummary(
  existingSummary: string,
  messagesToSummarize: Message[],
): Promise<SummaryResult> {
  if (messagesToSummarize.length === 0) {
    throw new Error('Cannot summarize empty message list')
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  // Build prompt
  const messagesText = messagesToSummarize
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
    const client = getOpenAIClient()
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
    const lastMessage = messagesToSummarize[messagesToSummarize.length - 1]

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
