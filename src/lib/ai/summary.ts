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

/**
 * Try to read a file from multiple possible paths.
 * This handles different environments (dev, production, serverless).
 */
function tryReadFile(possiblePaths: string[]): { content: string; path: string } | null {
  for (const filePath of possiblePaths) {
    try {
      const content = readFileSync(filePath, 'utf-8')
      return { content, path: filePath }
    } catch {
      // Try next path
      continue
    }
  }
  return null
}

// Load prompt from external file with a safe fallback so that missing files
// do not crash the agent chat endpoint at module load time (e.g. in serverless environments).
// First tries to load the main prompt file, then falls back to the default file, then to inline default.
let SUMMARY_SYSTEM_PROMPT: string = ''

// Try multiple path resolution strategies for different environments
// In Vercel, files might be in different locations depending on the build output
const cwd = process.cwd()
const possibleMainPaths = [
  // Standard path (works in dev and most production builds)
  join(__dirname, 'prompts/summary-system-prompt.md'),
  // Path relative to project root (works in some serverless environments)
  join(cwd, 'src/lib/ai/prompts/summary-system-prompt.md'),
  // Vercel serverless function path
  join(cwd, 'src', 'lib', 'ai', 'prompts', 'summary-system-prompt.md'),
  // Path from dist/build output (if files are copied there)
  join(cwd, '.next', 'server', 'app', 'lib', 'ai', 'prompts', 'summary-system-prompt.md'),
  // Alternative serverless path
  join(cwd, '.next', 'server', 'chunks', 'src', 'lib', 'ai', 'prompts', 'summary-system-prompt.md'),
]

const possibleDefaultPaths = [
  join(__dirname, 'prompts/summary-system-prompt.default.md'),
  join(cwd, 'src/lib/ai/prompts/summary-system-prompt.default.md'),
  join(cwd, 'src', 'lib', 'ai', 'prompts', 'summary-system-prompt.default.md'),
  join(cwd, '.next', 'server', 'app', 'lib', 'ai', 'prompts', 'summary-system-prompt.default.md'),
  join(cwd, '.next', 'server', 'chunks', 'src', 'lib', 'ai', 'prompts', 'summary-system-prompt.default.md'),
]

try {
  const result = tryReadFile(possibleMainPaths)
  if (result) {
    SUMMARY_SYSTEM_PROMPT = result.content
    logger.debug({ path: result.path }, '[Summary] Loaded summary system prompt from file')
  } else {
    throw new Error('Could not find summary-system-prompt.md in any expected location')
  }
} catch (error: unknown) {
  logger.warn(
    { err: error, paths: possibleMainPaths, cwd, __dirname },
    '[Summary] Failed to load summary system prompt from markdown file, trying default fallback',
  )

  // Try to load the default fallback file
  try {
    const result = tryReadFile(possibleDefaultPaths)
    if (result) {
      SUMMARY_SYSTEM_PROMPT = result.content
      logger.info({ path: result.path }, '[Summary] Loaded default summary prompt from fallback file')
    } else {
      throw new Error('Could not find default fallback file')
    }
  } catch (fallbackError: unknown) {
    logger.warn(
      { err: fallbackError, paths: possibleDefaultPaths },
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
    logger.info('[Summary] Using inline default prompt')
  }
}

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
