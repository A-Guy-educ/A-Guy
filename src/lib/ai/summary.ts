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
import { logger } from '@/utilities/logger'
import type { Message } from './context-policy'
// Import prompts directly - webpack will bundle them as strings
import summaryPrompt from './prompts/summary-system-prompt.md'
import summaryPromptDefault from './prompts/summary-system-prompt.default.md'

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

// Load prompt from imported markdown file with fallback
// Webpack bundles .md files as strings via next.config.js webpack loader
const SUMMARY_SYSTEM_PROMPT: string =
  summaryPrompt || summaryPromptDefault || [
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
