/**
 * Summary Generation Service
 * Compresses conversation history into concise summaries
 */

import { logger } from '@/infra/utils/logger'
import { readFileSync } from 'fs'
import OpenAI from 'openai'
import { dirname, join } from 'path'
import type { Payload } from 'payload'
import { fileURLToPath } from 'url'
import type { Message } from './context-policy'
import { getOpenAIClient } from './openai-client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface SummaryResult {
  summary: string
  summaryUntilTimestamp: Date
  tokensUsed: number
}

// Load prompt from external file with safe fallback
let SUMMARY_SYSTEM_PROMPT: string = ''

try {
  const promptPath = join(__dirname, 'prompts/summary-system-prompt.md')
  SUMMARY_SYSTEM_PROMPT = readFileSync(promptPath, 'utf-8')
} catch (error: unknown) {
  logger.warn(
    { err: error, path: join(__dirname, 'prompts/summary-system-prompt.md') },
    '[Summary] Failed to load prompt, using default',
  )

  try {
    const defaultPath = join(__dirname, 'prompts/summary-system-prompt.default.md')
    SUMMARY_SYSTEM_PROMPT = readFileSync(defaultPath, 'utf-8')
  } catch {
    SUMMARY_SYSTEM_PROMPT = [
      'You are a conversation summarizer for an educational chat system.',
      'Create concise, factual summaries.',
    ].join('\n')
  }
}

/**
 * Get OpenAI client for summary generation (always uses getSecret via getOpenAIClient)
 */
async function getSummaryClient(payload: Payload): Promise<OpenAI> {
  if (!payload) {
    throw new Error('Payload instance required for summary generation')
  }
  return getOpenAIClient(payload)
}

/**
 * Generate or update conversation summary
 */
export async function generateSummary(
  payload: Payload,
  messages: Message[],
  existingSummary?: string,
): Promise<SummaryResult> {
  if (messages.length === 0) {
    throw new Error('Cannot summarize empty message list')
  }

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
    const client = await getSummaryClient(payload)
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
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
